import { syncGameweek } from '../cron/handler';
import { MOCK_MATCHES } from '../football-data/mock-data';
import {
  ensureMockStateTable,
  MOCK_MATCH_COUNT,
  nextMockAction,
  readFinishedCount,
  setFinishedCount,
  type MockAction,
} from '../football-data/mock-state';
import type { Env, FixtureRow, GameweekRow } from '../types';
import { json } from '../utils/http';

interface MockStateView {
  finishedCount: number;
  totalMockFixtures: number;
  currentGameweek: { matchday: number; status: string } | null;
  fixtures: Array<{ home: string; away: string; mockWinner: string | null; result: string | null }>;
  nextAdvance: string;
}

export function isMockEnabled(env: Env): boolean {
  return env.USE_MOCK_FOOTBALL_DATA === 'true';
}

/**
 * Wipes gameweek data, resets the mock to "no fixtures finished", then runs a sync so a fresh
 * matchday-1 gameweek opens. One call for a clean loop.
 */
export async function handleMockReset(env: Env): Promise<Response> {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM predictions'),
    env.DB.prepare('DELETE FROM gameweek_reminders'),
    env.DB.prepare('DELETE FROM fixtures'),
    env.DB.prepare('DELETE FROM gameweeks'),
  ]);

  await ensureMockStateTable(env);
  await setFinishedCount(env, 0);

  await syncGameweek(env);

  return json({ action: 'reset', description: 'wiped gameweeks and opened matchday 1', state: await describeMockState(env) });
}

/**
 * Advances the mock by one step: lock the open gameweek (simulate the deadline passing), or
 * finish the next mock fixture. Then runs a sync so the app scores it, settles the gameweek
 * once its third fixture is done, and opens the next matchday.
 */
export async function handleMockAdvance(env: Env): Promise<Response> {
  await ensureMockStateTable(env);

  const openGameweek = await env.DB.prepare(
    "SELECT * FROM gameweeks WHERE status = 'open' ORDER BY matchday DESC LIMIT 1",
  ).first<GameweekRow>();

  const finishedCount = await readFinishedCount(env);

  const action = nextMockAction({
    openGameweekExists: openGameweek !== null,
    finishedCount,
    totalMatches: MOCK_MATCH_COUNT,
  });

  const description = await applyMockAction(env, action, openGameweek, finishedCount);

  await syncGameweek(env);

  return json({ action, description, state: await describeMockState(env) });
}

export async function handleMockState(env: Env): Promise<Response> {
  return json({ state: await describeMockState(env) });
}

async function applyMockAction(
  env: Env,
  action: MockAction,
  openGameweek: GameweekRow | null,
  finishedCount: number,
): Promise<string> {
  if (action === 'lock' && openGameweek) {
    await env.DB.prepare("UPDATE gameweeks SET status = 'locked' WHERE id = ?").bind(openGameweek.id).run();

    return `locked gameweek ${openGameweek.matchday}`;
  }

  const match = MOCK_MATCHES[finishedCount];

  if (action === 'finish' && match) {
    await setFinishedCount(env, finishedCount + 1);

    return `finished ${match.homeTeam} v ${match.awayTeam} => ${match.winner}`;
  }

  return 'every mock fixture has already finished';
}

async function describeMockState(env: Env): Promise<MockStateView> {
  const finishedCount = await readFinishedCount(env);

  const gameweek = await env.DB.prepare(
    "SELECT * FROM gameweeks WHERE status IN ('open', 'locked') ORDER BY matchday DESC LIMIT 1",
  ).first<GameweekRow>();

  const fixtures = gameweek
    ? (
        await env.DB.prepare('SELECT * FROM fixtures WHERE gameweek_id = ? ORDER BY id')
          .bind(gameweek.id)
          .all<FixtureRow>()
      ).results
    : [];

  const action = nextMockAction({
    openGameweekExists: gameweek?.status === 'open',
    finishedCount,
    totalMatches: MOCK_MATCH_COUNT,
  });

  return {
    finishedCount,
    totalMockFixtures: MOCK_MATCH_COUNT,
    currentGameweek: gameweek ? { matchday: gameweek.matchday, status: gameweek.status } : null,
    fixtures: fixtures.map((fixture) => ({
      home: fixture.home_team,
      away: fixture.away_team,
      mockWinner: MOCK_MATCHES.find((match) => match.id === fixture.pl_match_id)?.winner ?? null,
      result: fixture.result,
    })),
    nextAdvance: describeNextAdvance(action, finishedCount),
  };
}

function describeNextAdvance(action: MockAction, finishedCount: number): string {
  if (action === 'lock') {
    return 'lock the open gameweek (simulate the deadline passing)';
  }

  const match = MOCK_MATCHES[finishedCount];

  if (action === 'exhausted' || !match) {
    return 'nothing - every mock fixture has finished';
  }

  return `finish ${match.homeTeam} v ${match.awayTeam} (${match.winner})`;
}
