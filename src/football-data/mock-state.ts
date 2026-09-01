import type { Env } from '../types';
import { MOCK_MATCHES } from './mock-data';

export const MOCK_MATCH_COUNT = MOCK_MATCHES.length;

export const MOCK_STATE_DDL =
  'CREATE TABLE IF NOT EXISTS mock_football_state (' +
  'id INTEGER PRIMARY KEY CHECK (id = 1), finished_count INTEGER NOT NULL DEFAULT 0)';

export async function ensureMockStateTable(env: Env): Promise<void> {
  await env.DB.prepare(MOCK_STATE_DDL).run();
  await env.DB.prepare('INSERT OR IGNORE INTO mock_football_state (id, finished_count) VALUES (1, 0)').run();
}

export async function readFinishedCount(env: Env): Promise<number> {
  await ensureMockStateTable(env);

  const row = await env.DB.prepare('SELECT finished_count FROM mock_football_state WHERE id = 1').first<{
    finished_count: number;
  }>();

  return row?.finished_count ?? 0;
}

export async function setFinishedCount(env: Env, finishedCount: number): Promise<void> {
  await ensureMockStateTable(env);

  await env.DB.prepare('UPDATE mock_football_state SET finished_count = ? WHERE id = 1')
    .bind(finishedCount)
    .run();
}

export type MockAction = 'lock' | 'finish' | 'exhausted';

/**
 * What the next /api/dev/mock/advance call should do: lock the open gameweek (simulate the
 * deadline passing), finish the next mock match, or report that every mock match is done.
 */
export function nextMockAction(params: {
  openGameweekExists: boolean;
  finishedCount: number;
  totalMatches: number;
}): MockAction {
  if (params.openGameweekExists) {
    return 'lock';
  }

  if (params.finishedCount >= params.totalMatches) {
    return 'exhausted';
  }

  return 'finish';
}
