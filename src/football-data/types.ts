export interface FdTeam {
  id: number;
  name: string;
}

export interface FdStandingRow {
  position: number;
  team: FdTeam;
}

export interface FdSeason {
  startDate: string;
  endDate: string;
  currentMatchday: number;
}

export interface FdStandingsResponse {
  season: FdSeason;
  standings: Array<{
    type: 'TOTAL' | 'HOME' | 'AWAY';
    table: FdStandingRow[];
  }>;
}

export type FdMatchStatus =
  | 'SCHEDULED'
  | 'TIMED'
  | 'IN_PLAY'
  | 'PAUSED'
  | 'FINISHED'
  | 'POSTPONED'
  | 'SUSPENDED'
  | 'CANCELLED';

export type FdMatchWinner = 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null;

export interface FdMatch {
  id: number;
  utcDate: string;
  status: FdMatchStatus;
  matchday: number;
  homeTeam: FdTeam;
  awayTeam: FdTeam;
  score: {
    winner: FdMatchWinner;
  };
}

export interface FdMatchesResponse {
  matches: FdMatch[];
}

export interface FootballDataApi {
  getStandings(): Promise<FdStandingsResponse>;
  getScheduledMatches(): Promise<FdMatchesResponse>;
  getMatch(matchId: number): Promise<FdMatch>;
}
