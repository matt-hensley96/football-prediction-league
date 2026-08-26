import { describe, expect, it } from 'vitest';
import { outcomeFromWinner, scorePrediction } from './scorer';

describe('scorePrediction', () => {
  it.each([
    ['HOME', 'HOME', 3],
    ['AWAY', 'AWAY', 3],
    ['DRAW', 'DRAW', 3],
    ['HOME', 'AWAY', -1],
    ['AWAY', 'HOME', -1],
    ['HOME', 'DRAW', 0],
    ['AWAY', 'DRAW', 0],
    ['DRAW', 'HOME', 0],
    ['DRAW', 'AWAY', 0],
  ] as const)('pick=%s actual=%s -> %i points', (pick, actual, expected) => {
    expect(scorePrediction(pick, actual)).toBe(expected);
  });
});

describe('outcomeFromWinner', () => {
  it('maps football-data.org winner values to our Outcome type', () => {
    expect(outcomeFromWinner('HOME_TEAM')).toBe('HOME');
    expect(outcomeFromWinner('AWAY_TEAM')).toBe('AWAY');
    expect(outcomeFromWinner('DRAW')).toBe('DRAW');
    expect(outcomeFromWinner(null)).toBeNull();
  });
});
