import type { Env } from '../types';
import type { FdMatch, FdMatchesResponse, FdStandingsResponse, FootballDataApi } from './types';
import { MOCK_MATCHES, MOCK_SEASON_END_DATE, MOCK_STANDINGS, mockKickoffIso, type MockMatch } from './mock-data';
import { readFinishedCount } from './mock-state';

/**
 * Stand-in for FootballDataClient used only when USE_MOCK_FOOTBALL_DATA is set. Fixtures and
 * results come from MOCK_MATCHES; a match reports FINISHED once its position in that list is
 * below the mock's finished_count, which the /api/dev/mock/advance endpoint steps forward.
 */
export class MockFootballDataClient implements FootballDataApi {
  constructor(private readonly env: Env) {}

  async getStandings(): Promise<FdStandingsResponse> {
    return {
      season: { startDate: '2099-08-01', endDate: MOCK_SEASON_END_DATE, currentMatchday: 1 },
      standings: [
        {
          type: 'TOTAL',
          table: MOCK_STANDINGS.map((row) => ({
            position: row.position,
            team: { id: row.teamId, name: row.teamName },
          })),
        },
      ],
    };
  }

  async getScheduledMatches(): Promise<FdMatchesResponse> {
    const finishedCount = await readFinishedCount(this.env);

    const matches = MOCK_MATCHES.filter((_, index) => index >= finishedCount).map((match) =>
      toFdMatch(match, mockKickoffIso(match.kickoffTime), false),
    );

    return { matches };
  }

  async getMatch(matchId: number): Promise<FdMatch> {
    const index = MOCK_MATCHES.findIndex((match) => match.id === matchId);
    const match = MOCK_MATCHES[index];

    if (!match) {
      throw new Error(`football-data.org request to /matches/${matchId} failed: 404 no such mock match`);
    }

    const finishedCount = await readFinishedCount(this.env);

    return toFdMatch(match, mockKickoffIso(match.kickoffTime), index < finishedCount);
  }
}

function toFdMatch(match: MockMatch, kickoff: string, finished: boolean): FdMatch {
  const status = !finished ? 'SCHEDULED' : (match.unplayable ?? 'FINISHED');

  return {
    id: match.id,
    utcDate: kickoff,
    status,
    matchday: match.matchday,
    homeTeam: { id: match.id * 10, name: match.homeTeam },
    awayTeam: { id: match.id * 10 + 1, name: match.awayTeam },
    score: { winner: status === 'FINISHED' ? match.winner : null },
  };
}
