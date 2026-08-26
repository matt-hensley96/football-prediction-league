import { describe, expect, it, vi } from 'vitest';
import { determineNextGameweekFixtures } from './gameweek-selector';
import type { FdMatch } from './types';

function match(id: number, matchday: number): FdMatch {
  return {
    id,
    utcDate: '2026-01-01T15:00:00Z',
    status: 'SCHEDULED',
    matchday,
    homeTeam: { id: id * 10, name: `Home ${id}` },
    awayTeam: { id: id * 10 + 1, name: `Away ${id}` },
    score: { winner: null },
  };
}

function client(matches: FdMatch[]) {
  return { getScheduledMatches: vi.fn().mockResolvedValue({ matches }) } as never;
}

describe('determineNextGameweekFixtures', () => {
  it('picks 3 fixtures from the earliest matchday not already created', async () => {
    const matches = [match(1, 6), match(2, 6), match(3, 6), match(4, 7)];

    const result = await determineNextGameweekFixtures(client(matches), new Set());

    expect(result?.matchday).toBe(6);
    expect(result?.fixtures).toHaveLength(3);
    expect(result?.fixtures.every((f) => f.matchday === 6)).toBe(true);
  });

  it('skips matchdays that already have a gameweek', async () => {
    const matches = [match(1, 6), match(2, 6), match(3, 6), match(4, 7), match(5, 7), match(6, 7)];

    const result = await determineNextGameweekFixtures(client(matches), new Set([6]));

    expect(result?.matchday).toBe(7);
  });

  it('returns null when the next matchday has fewer than 3 scheduled matches', async () => {
    const matches = [match(1, 6), match(2, 6)];

    const result = await determineNextGameweekFixtures(client(matches), new Set());

    expect(result).toBeNull();
  });

  it('returns null when there are no upcoming matchdays', async () => {
    const result = await determineNextGameweekFixtures(client([]), new Set());

    expect(result).toBeNull();
  });
});
