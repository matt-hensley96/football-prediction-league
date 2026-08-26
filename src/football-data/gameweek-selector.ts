import type { FootballDataClient } from './client';
import type { FdMatch, FdStandingRow, FdTeam } from './types';
import type { FixtureCategory } from '../types';

export interface SelectedFixture {
  category: FixtureCategory;
  match: FdMatch;
}

export interface SelectedGameweek {
  matchday: number;
  fixtures: [SelectedFixture, SelectedFixture, SelectedFixture];
}

function isManUtd(team: FdTeam): boolean {
  return team.name.includes('Manchester United');
}

function isLeeds(team: FdTeam): boolean {
  return team.name.includes('Leeds');
}

/**
 * Walks the table from the top, skipping Man Utd and Leeds, since either of
 * them being top of the table should defer to the next-highest team.
 */
export function pickTopTeamExcludingManUtdAndLeeds(table: FdStandingRow[]): FdTeam {
  const sorted = [...table].sort((a, b) => a.position - b.position);
  const row = sorted.find((r) => !isManUtd(r.team) && !isLeeds(r.team));

  if (!row) {
    throw new Error('No eligible top-of-table team found (table is empty or malformed)');
  }

  return row.team;
}

function findTeamMatch(matches: FdMatch[], predicate: (team: FdTeam) => boolean): FdMatch | undefined {
  return matches.find((m) => predicate(m.homeTeam) || predicate(m.awayTeam));
}

function findTopTeamMatch(matches: FdMatch[], topTeam: FdTeam): FdMatch | undefined {
  return matches.find((m) => m.homeTeam.id === topTeam.id || m.awayTeam.id === topTeam.id);
}

/**
 * Determines the next not-yet-created gameweek's 3 fixtures, or null if the
 * next matchday's fixtures aren't fully known yet (e.g. one of the 3 teams
 * has no scheduled match in the next matchday).
 */
export async function determineNextGameweekFixtures(
  client: FootballDataClient,
  existingMatchdays: Set<number>,
): Promise<SelectedGameweek | null> {
  const [standingsResponse, matchesResponse] = await Promise.all([
    client.getStandings(),
    client.getScheduledMatches(),
  ]);

  const totalTable = standingsResponse.standings.find((s) => s.type === 'TOTAL')?.table ?? [];
  const topTeam = pickTopTeamExcludingManUtdAndLeeds(totalTable);

  const upcomingMatchdays = [...new Set(matchesResponse.matches.map((m) => m.matchday))]
    .filter((md) => !existingMatchdays.has(md))
    .sort((a, b) => a - b);

  const nextMatchday = upcomingMatchdays[0];

  if (nextMatchday === undefined) {
    return null;
  }

  const matchesInMatchday = matchesResponse.matches.filter((m) => m.matchday === nextMatchday);

  const manUtdMatch = findTeamMatch(matchesInMatchday, isManUtd);
  const leedsMatch = findTeamMatch(matchesInMatchday, isLeeds);
  const topTeamMatch = findTopTeamMatch(matchesInMatchday, topTeam);

  if (!manUtdMatch || !leedsMatch || !topTeamMatch) {
    return null;
  }

  return {
    matchday: nextMatchday,
    fixtures: [
      { category: 'man_utd', match: manUtdMatch },
      { category: 'leeds', match: leedsMatch },
      { category: 'top_of_table', match: topTeamMatch },
    ],
  };
}
