import { syncGameweek } from '../cron/handler';
import { claimSyncSlot, isSyncStale, readLastSyncedAt } from '../cron/sync-state';
import type { Env } from '../types';
import { json } from '../utils/http';

export async function handleSyncRequest(env: Env): Promise<Response> {
  const lastSyncedAt = await readLastSyncedAt(env);

  if (!isSyncStale(lastSyncedAt, new Date())) {
    return json({ synced: false, lastSyncedAt });
  }

  const claimed = await claimSyncSlot(env);

  if (!claimed) {
    return json({ synced: false, lastSyncedAt: await readLastSyncedAt(env) });
  }

  await syncGameweek(env);

  return json({ synced: true, lastSyncedAt: await readLastSyncedAt(env) });
}
