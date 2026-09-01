import type { Env } from '../types';

/**
 * Shortest gap between real syncGameweek runs triggered by site traffic.
 *
 * The SQL in claimSyncSlot uses datetime('now', '-15 minutes') to gate the same window.
 * Keep the two in step if this changes.
 */
export const SYNC_INTERVAL_MS = 15 * 60 * 1000;

export function isSyncStale(lastSyncedAt: string | null, now: Date): boolean {
  if (lastSyncedAt === null) {
    return true;
  }

  const lastSyncedMs = new Date(`${lastSyncedAt.replace(' ', 'T')}Z`).getTime();

  if (Number.isNaN(lastSyncedMs)) {
    return true;
  }

  return now.getTime() - lastSyncedMs >= SYNC_INTERVAL_MS;
}

export async function readLastSyncedAt(env: Env): Promise<string | null> {
  const row = await env.DB.prepare('SELECT last_synced_at FROM sync_state WHERE id = 1').first<{
    last_synced_at: string | null;
  }>();

  return row?.last_synced_at ?? null;
}

export async function markSynced(env: Env): Promise<void> {
  await env.DB.prepare("UPDATE sync_state SET last_synced_at = datetime('now') WHERE id = 1").run();
}

/**
 * Atomically claims the right to run a sync: stamps last_synced_at to now, but only if no sync
 * has landed in the last 15 minutes. Returns true for the single caller that wins the claim, so
 * concurrent page renders can't each kick off their own syncGameweek.
 */
export async function claimSyncSlot(env: Env): Promise<boolean> {
  const result = await env.DB.prepare(
    `UPDATE sync_state SET last_synced_at = datetime('now')
     WHERE id = 1
       AND (last_synced_at IS NULL OR datetime(last_synced_at) <= datetime('now', '-15 minutes'))`,
  ).run();

  return result.meta.changes === 1;
}
