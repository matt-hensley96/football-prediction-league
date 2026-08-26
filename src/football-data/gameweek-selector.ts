import type { FootballDataClient } from './client';
import type { FdMatch } from './types';

export interface SelectedGameweek {
  matchday: number;
  fixtures: [FdMatch, FdMatch, FdMatch];
}

function pickRandomFixtures(matches: FdMatch[]): [FdMatch, FdMatch, FdMatch] | null {
  if (matches.length < 3) {
    return null;
  }

  const shuffled = [...matches].sort(() => Math.random() - 0.5);

  return shuffled.slice(0, 3) as [FdMatch, FdMatch, FdMatch];
}

/**
 * Determines the next not-yet-created gameweek's 3 fixtures, or null if the
 * next matchday has fewer than 3 scheduled Premier League matches.
 */
export async function determineNextGameweekFixtures(
  client: FootballDataClient,
  existingMatchdays: Set<number>,
): Promise<SelectedGameweek | null> {
  const matchesResponse = await client.getScheduledMatches();

  const upcomingMatchdays = [...new Set(matchesResponse.matches.map((m) => m.matchday))]
    .filter((md) => !existingMatchdays.has(md))
    .sort((a, b) => a - b);

  const nextMatchday = upcomingMatchdays[0];

  if (nextMatchday === undefined) {
    return null;
  }

  const matchesInMatchday = matchesResponse.matches.filter((m) => m.matchday === nextMatchday);
  const fixtures = pickRandomFixtures(matchesInMatchday);

  if (!fixtures) {
    return null;
  }

  return { matchday: nextMatchday, fixtures };
}
