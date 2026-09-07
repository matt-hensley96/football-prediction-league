import type { FdMatchWinner } from './types';

/**
 * The mock's fixtures and results are fixed. Only used when USE_MOCK_FOOTBALL_DATA is set,
 * so a developer can run the whole gameweek lifecycle locally without the real API.
 */
export interface MockMatch {
  id: number;
  matchday: number;
  homeTeam: string;
  awayTeam: string;
  winner: Exclude<FdMatchWinner, null>;
  kickoffTime: string; /** "HH:MM" */
  unplayable?: 'POSTPONED' | 'CANCELLED' | 'SUSPENDED';
}

export const MOCK_SEASON_END_DATE = '2099-05-31';

/**
 * Determines how many days in the future the mock fixtures will be scheduled for.
 */
export const MOCK_KICKOFF_DAYS_AHEAD = 7;

/**
 * Ordered flat list. A match counts as finished once its index is below the mock's
 * finished_count. Each matchday has exactly 3 fixtures; matchday 2's second fixture is
 * postponed rather than played, so the void-fixture path is exercised by the mock walkthrough
 * (and the still-locked gameweek can be viewed with a mix of scored / voided / pending cards).
 */
export const MOCK_MATCHES: readonly MockMatch[] = [
  { id: 9001, matchday: 1, homeTeam: 'Arsenal', awayTeam: 'Chelsea', winner: 'HOME_TEAM', kickoffTime: '12:30' },
  { id: 9002, matchday: 1, homeTeam: 'Everton', awayTeam: 'Liverpool', winner: 'AWAY_TEAM', kickoffTime: '16:30' },
  { id: 9003, matchday: 1, homeTeam: 'Brighton', awayTeam: 'Newcastle', winner: 'DRAW', kickoffTime: '20:00' },
  { id: 9004, matchday: 2, homeTeam: 'Manchester City', awayTeam: 'Tottenham', winner: 'HOME_TEAM', kickoffTime: '12:30' },
  { id: 9005, matchday: 2, homeTeam: 'Aston Villa', awayTeam: 'Manchester United', winner: 'DRAW', kickoffTime: '16:30', unplayable: 'POSTPONED' },
  { id: 9006, matchday: 2, homeTeam: 'Fulham', awayTeam: 'Crystal Palace', winner: 'AWAY_TEAM', kickoffTime: '20:00' },
  { id: 9007, matchday: 3, homeTeam: 'Nottingham Forest', awayTeam: 'Brentford', winner: 'HOME_TEAM', kickoffTime: '12:30' },
  { id: 9008, matchday: 3, homeTeam: 'West Ham', awayTeam: 'Wolverhampton', winner: 'AWAY_TEAM', kickoffTime: '16:30' },
  { id: 9009, matchday: 3, homeTeam: 'Bournemouth', awayTeam: 'Leicester', winner: 'DRAW', kickoffTime: '20:00' },
];

export function mockKickoffIso(kickoff: string, now: Date = new Date()): string {
  const [hours, minutes] = kickoff.split(':');
  const date = new Date(now);

  date.setDate(date.getDate() + MOCK_KICKOFF_DAYS_AHEAD);
  date.setHours(Number(hours), Number(minutes), 0, 0);

  return date.toISOString();
}