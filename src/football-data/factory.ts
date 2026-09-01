import type { Env } from '../types';
import { FootballDataClient } from './client';
import { MockFootballDataClient } from './mock-client';
import type { FootballDataApi } from './types';

export function createFootballDataClient(env: Env): FootballDataApi {
  if (env.USE_MOCK_FOOTBALL_DATA === 'true') {
    return new MockFootballDataClient(env);
  }

  return new FootballDataClient(env.FOOTBALL_DATA_TOKEN);
}
