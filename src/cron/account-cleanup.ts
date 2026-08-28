import type { Env } from '../types';

const CONSECUTIVE_MISSES_TO_DEACTIVATE = 3;

export interface RecentScoredGameweek {
  id: number;
  deadline: string;
}

export function shouldDeactivateForInactivity(
  recentScoredGameweeks: RecentScoredGameweek[],
  userCreatedAt: string,
  gameweekIdsUserPredictedIn: ReadonlySet<number>,
): boolean {
  const joinedAt = new Date(userCreatedAt).getTime();

  const eligible = recentScoredGameweeks.filter((gameweek) => new Date(gameweek.deadline).getTime() > joinedAt);

  if (eligible.length < CONSECUTIVE_MISSES_TO_DEACTIVATE) {
    return false;
  }

  return eligible
    .slice(0, CONSECUTIVE_MISSES_TO_DEACTIVATE)
    .every((gameweek) => !gameweekIdsUserPredictedIn.has(gameweek.id));
}

export async function deactivateInactiveAccounts(env: Env): Promise<void> {
  const recentScoredGameweeks = await env.DB.prepare(
    "SELECT id, deadline FROM gameweeks WHERE status = 'scored' ORDER BY matchday DESC LIMIT ?",
  )
    .bind(CONSECUTIVE_MISSES_TO_DEACTIVATE)
    .all<RecentScoredGameweek>();

  if (recentScoredGameweeks.results.length < CONSECUTIVE_MISSES_TO_DEACTIVATE) {
    return;
  }

  const activeUsers = await env.DB.prepare(
    'SELECT id, created_at FROM users WHERE is_system = 0 AND deactivated_at IS NULL',
  ).all<{ id: number; created_at: string }>();

  const recentGameweekIds = recentScoredGameweeks.results.map((gameweek) => gameweek.id);

  for (const user of activeUsers.results) {
    const predictedIn = await gameweekIdsPredictedIn(env, user.id, recentGameweekIds);

    if (!shouldDeactivateForInactivity(recentScoredGameweeks.results, user.created_at, predictedIn)) {
      continue;
    }

    await env.DB.prepare("UPDATE users SET deactivated_at = datetime('now') WHERE id = ?").bind(user.id).run();
  }
}

async function gameweekIdsPredictedIn(
  env: Env,
  userId: number,
  gameweekIds: number[],
): Promise<ReadonlySet<number>> {
  const placeholders = gameweekIds.map(() => '?').join(', ');

  const rows = await env.DB.prepare(
    `SELECT DISTINCT f.gameweek_id AS gameweek_id
     FROM predictions p
     JOIN fixtures f ON f.id = p.fixture_id
     WHERE p.user_id = ? AND f.gameweek_id IN (${placeholders})`,
  )
    .bind(userId, ...gameweekIds)
    .all<{ gameweek_id: number }>();

  return new Set(rows.results.map((row) => row.gameweek_id));
}
