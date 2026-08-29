import { FootballDataClient } from '../football-data/client';
import type { Env } from '../types';
import { deactivateInactiveAccounts } from './account-cleanup';
import { checkAndSendSeasonSummary } from './season-summary';

export async function runWeeklyCleanup(env: Env): Promise<void> {
  const client = new FootballDataClient(env.FOOTBALL_DATA_TOKEN);

  await deactivateInactiveAccounts(env);
  await checkAndSendSeasonSummary(env, client);
}
