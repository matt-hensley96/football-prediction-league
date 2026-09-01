import { createFootballDataClient } from '../football-data/factory';
import type { Env } from '../types';
import { deactivateInactiveAccounts } from './account-cleanup';
import { checkAndSendSeasonSummary } from './season-summary';

export async function cleanupUsers(env: Env): Promise<void> {
  const client = createFootballDataClient(env);

  await deactivateInactiveAccounts(env);
  await checkAndSendSeasonSummary(env, client);
}
