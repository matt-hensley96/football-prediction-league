import { describe, expect, it } from 'vitest';
import { shouldDeactivateForInactivity } from './account-cleanup';
import type { RecentScoredGameweek } from './account-cleanup';

describe('shouldDeactivateForInactivity', () => {
  const joinedLongAgo = '2026-01-01T00:00:00Z';

  const lastThreeScored: RecentScoredGameweek[] = [
    { id: 30, deadline: '2026-03-01T15:00:00Z' },
    { id: 20, deadline: '2026-02-01T15:00:00Z' },
    { id: 10, deadline: '2026-01-15T15:00:00Z' },
  ];

  it('does not deactivate when fewer than three scored gameweeks exist', () => {
    const twoScored = lastThreeScored.slice(0, 2);

    expect(shouldDeactivateForInactivity(twoScored, joinedLongAgo, new Set())).toBe(false);
  });

  it('does not deactivate when only two of the last three fall after the join date', () => {
    const joinedBetweenGameweeks = '2026-01-20T00:00:00Z';

    expect(shouldDeactivateForInactivity(lastThreeScored, joinedBetweenGameweeks, new Set())).toBe(false);
  });

  it('deactivates when all three are eligible and none were predicted', () => {
    expect(shouldDeactivateForInactivity(lastThreeScored, joinedLongAgo, new Set())).toBe(true);
  });

  it('does not deactivate when one of the last three was predicted', () => {
    expect(shouldDeactivateForInactivity(lastThreeScored, joinedLongAgo, new Set([20]))).toBe(false);
  });

  it('deactivates even when an older gameweek was predicted, since only the last three count', () => {
    expect(shouldDeactivateForInactivity(lastThreeScored, joinedLongAgo, new Set([5]))).toBe(true);
  });
});
