import type { FdMatchesResponse, FdMatchResponse, FdStandingsResponse } from './types';

const BASE_URL = 'https://api.football-data.org/v4';

export class FootballDataClient {
  constructor(private readonly token: string) {}

  getStandings(): Promise<FdStandingsResponse> {
    return this.get<FdStandingsResponse>('/competitions/PL/standings');
  }

  getScheduledMatches(): Promise<FdMatchesResponse> {
    return this.get<FdMatchesResponse>('/competitions/PL/matches?status=SCHEDULED');
  }

  getMatch(matchId: number): Promise<FdMatchResponse> {
    return this.get<FdMatchResponse>(`/matches/${matchId}`);
  }

  private async get<T>(path: string): Promise<T> {
    const response = await fetch(`${BASE_URL}${path}`, {
      headers: { 'X-Auth-Token': this.token },
    });

    if (!response.ok) {
      const body = await response.text();

      throw new Error(`football-data.org request to ${path} failed: ${response.status} ${body}`);
    }

    return response.json();
  }
}
