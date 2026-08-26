import { FootballDataClient } from '../football-data/client';
import { determineNextGameweekFixtures } from '../football-data/gameweek-selector';
import { outcomeFromWinner, scorePrediction } from '../scoring/scorer';
import { checkAndSendSeasonSummary } from './season-summary';
import { sendGameweekResultsEmails } from './results-email';
import type { GameweekPickRow } from './results-email';
import type { Env, FixtureRow, GameweekRow, Outcome, PredictionRow } from '../types';

export async function runDaily(env: Env): Promise<void> {
  const client = new FootballDataClient(env.FOOTBALL_DATA_TOKEN);

  await lockPastDeadlines(env);
  await scoreFinishedGameweeks(env, client);
  await maybeOpenNextGameweek(env, client);
  await checkAndSendSeasonSummary(env, client);
}

async function lockPastDeadlines(env: Env): Promise<void> {
  await env.DB.prepare(
    "UPDATE gameweeks SET status = 'locked' WHERE status = 'open' AND deadline <= datetime('now')",
  ).run();
}

async function scoreFinishedGameweeks(env: Env, client: FootballDataClient): Promise<void> {
  const lockedGameweeks = await env.DB.prepare("SELECT * FROM gameweeks WHERE status = 'locked'").all<GameweekRow>();

  for (const gameweek of lockedGameweeks.results) {
    await scoreGameweekIfFinished(env, client, gameweek);
  }
}

async function scoreGameweekIfFinished(
  env: Env,
  client: FootballDataClient,
  gameweek: GameweekRow,
): Promise<void> {
  const fixtures = await env.DB.prepare('SELECT * FROM fixtures WHERE gameweek_id = ?')
    .bind(gameweek.id)
    .all<FixtureRow>();

  const results = await Promise.all(
    fixtures.results.map(async (fixture) => {
      const { match } = await client.getMatch(fixture.pl_match_id);

      return { fixture, outcome: match.status === 'FINISHED' ? outcomeFromWinner(match.score.winner) : null };
    }),
  );

  const allFinished = results.every((r) => r.outcome !== null);

  if (!allFinished) {
    return;
  }

  for (const { fixture, outcome } of results) {
    fixture.result = outcome;

    await scoreFixture(env, fixture, outcome as Outcome);
  }

  await env.DB.prepare("UPDATE gameweeks SET status = 'scored' WHERE id = ?").bind(gameweek.id).run();

  const picks = await env.DB.prepare(
    `SELECT u.id AS user_id, u.name AS name, u.email AS email, p.fixture_id AS fixture_id,
            p.pick AS pick, p.points_awarded AS points_awarded
     FROM predictions p
     JOIN users u ON u.id = p.user_id
     WHERE p.fixture_id IN (SELECT id FROM fixtures WHERE gameweek_id = ?) AND u.is_system = 0`,
  )
    .bind(gameweek.id)
    .all<GameweekPickRow>();

  await sendGameweekResultsEmails(env, gameweek, fixtures.results, picks.results);
}

async function scoreFixture(env: Env, fixture: FixtureRow, outcome: Outcome): Promise<void> {
  await env.DB.prepare('UPDATE fixtures SET result = ? WHERE id = ?').bind(outcome, fixture.id).run();

  const predictions = await env.DB.prepare('SELECT * FROM predictions WHERE fixture_id = ?')
    .bind(fixture.id)
    .all<PredictionRow>();

  for (const prediction of predictions.results) {
    const points = scorePrediction(prediction.pick, outcome);

    await env.DB.prepare('UPDATE predictions SET points_awarded = ? WHERE id = ?')
      .bind(points, prediction.id)
      .run();
  }
}

/**
 * A gameweek opens once there's nothing still awaiting a result — i.e. every existing gameweek
 * has been fully scored (or there are none yet, for the very first gameweek). This is checked
 * instead of a fixed lead-time-before-kickoff window, since the group would rather have the next
 * predictions open as soon as the previous ones are settled.
 */
async function maybeOpenNextGameweek(env: Env, client: FootballDataClient): Promise<void> {
  const pendingGameweek = await env.DB.prepare("SELECT 1 FROM gameweeks WHERE status != 'scored' LIMIT 1").first();

  if (pendingGameweek) {
    return;
  }

  const existing = await env.DB.prepare('SELECT matchday FROM gameweeks').all<{ matchday: number }>();
  const existingMatchdays = new Set(existing.results.map((r) => r.matchday));

  const selection = await determineNextGameweekFixtures(client, existingMatchdays);

  if (!selection) {
    return;
  }

  const earliestKickoff = selection.fixtures
    .map((f) => new Date(f.utcDate).getTime())
    .reduce((earliest, current) => Math.min(earliest, current), Infinity);

  const deadline = new Date(earliestKickoff).toISOString();

  const insertedGameweek = await env.DB.prepare(
    'INSERT INTO gameweeks (matchday, deadline, status) VALUES (?, ?, ?) RETURNING id',
  )
    .bind(selection.matchday, deadline, 'open')
    .first<{ id: number }>();

  if (!insertedGameweek) {
    throw new Error('Failed to insert gameweek');
  }

  const superComputer = await env.DB.prepare('SELECT id FROM users WHERE is_system = 1 LIMIT 1').first<{
    id: number;
  }>();

  for (const fixture of selection.fixtures) {
    const insertedFixture = await env.DB.prepare(
      `INSERT INTO fixtures (gameweek_id, home_team, away_team, kickoff_time, pl_match_id)
       VALUES (?, ?, ?, ?, ?) RETURNING id`,
    )
      .bind(
        insertedGameweek.id,
        fixture.homeTeam.name,
        fixture.awayTeam.name,
        fixture.utcDate,
        fixture.id,
      )
      .first<{ id: number }>();

    if (insertedFixture && superComputer) {
      await env.DB.prepare('INSERT INTO predictions (user_id, fixture_id, pick) VALUES (?, ?, ?)')
        .bind(superComputer.id, insertedFixture.id, 'HOME')
        .run();
    }
  }
}
