import { createFootballDataClient } from '../football-data/factory';
import { determineNextGameweekFixtures } from '../football-data/gameweek-selector';
import type { FootballDataApi } from '../football-data/types';
import { outcomeIfFinished, scorePrediction, voidReasonIfUnplayable } from '../scoring/scorer';
import { gameweekIsSettled, type FixtureSettlementState } from '../scoring/settlement';
import type { Env, FixtureRow, GameweekRow, Outcome, PredictionRow } from '../types';

interface FixtureWithVoid extends FixtureRow {
  void_reason: string | null;
}

export async function syncGameweek(env: Env): Promise<void> {
  const client = createFootballDataClient(env);

  await lockPastDeadlines(env);
  await scoreFinishedFixtures(env, client);
  await maybeOpenNextGameweek(env, client);
}

async function lockPastDeadlines(env: Env): Promise<void> {
  await env.DB.prepare(
    "UPDATE gameweeks SET status = 'locked' WHERE status = 'open' AND datetime(deadline) <= datetime('now')",
  ).run();
}

async function scoreFinishedFixtures(env: Env, client: FootballDataApi): Promise<void> {
  const lockedGameweeks = await env.DB.prepare("SELECT * FROM gameweeks WHERE status = 'locked'").all<GameweekRow>();

  for (const gameweek of lockedGameweeks.results) {
    await scoreNewlyFinishedFixtures(env, client, gameweek);
  }
}

async function scoreNewlyFinishedFixtures(
  env: Env,
  client: FootballDataApi,
  gameweek: GameweekRow,
): Promise<void> {
  const fixtures = await env.DB.prepare(
    `SELECT f.*, v.reason AS void_reason
     FROM fixtures f
     LEFT JOIN voided_fixtures v ON v.fixture_id = f.id
     WHERE f.gameweek_id = ?`,
  )
    .bind(gameweek.id)
    .all<FixtureWithVoid>();

  const settlementState: FixtureSettlementState[] = [];

  for (const fixture of fixtures.results) {
    let result = fixture.result;
    let voided = fixture.void_reason !== null;

    if (result === null && !voided) {
      const match = await client.getMatch(fixture.pl_match_id);
      const outcome = outcomeIfFinished(match);

      if (outcome !== null) {
        await scoreFixture(env, fixture, outcome);
        result = outcome;
      } else {
        const voidReason = voidReasonIfUnplayable(match);

        if (voidReason !== null) {
          await env.DB.prepare('INSERT OR IGNORE INTO voided_fixtures (fixture_id, reason) VALUES (?, ?)')
            .bind(fixture.id, voidReason)
            .run();
          voided = true;
        }
      }
    }

    settlementState.push({ result, voided });
  }

  await settleGameweekIfComplete(env, gameweek, settlementState);
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
 * A gameweek is settled once every one of its fixtures has a result or has been voided (a
 * POSTPONED/CANCELLED/SUSPENDED match - see voided_fixtures). Fixtures are scored individually
 * as each match finishes (so the live league table moves match by match); this check runs on
 * every sync, so a gameweek still settles on a later tick even when nothing new was scored -
 * e.g. the last pending fixture was voided rather than played.
 */
async function settleGameweekIfComplete(
  env: Env,
  gameweek: GameweekRow,
  fixtures: FixtureSettlementState[],
): Promise<void> {
  if (gameweek.status !== 'locked' || !gameweekIsSettled(fixtures)) {
    return;
  }

  await env.DB.prepare("UPDATE gameweeks SET status = 'scored' WHERE id = ?").bind(gameweek.id).run();
}

/**
 * A gameweek opens once there's nothing still awaiting a result — i.e. every existing gameweek
 * has been fully scored (or there are none yet, for the very first gameweek). This is checked
 * instead of a fixed lead-time-before-kickoff window, since the group would rather have the next
 * predictions open as soon as the previous ones are settled.
 */
async function maybeOpenNextGameweek(env: Env, client: FootballDataApi): Promise<void> {
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
