import { describe, expect, it } from 'vitest';
import type { FdMatch, FdMatchStatus, FdMatchWinner } from '../football-data/types';
import { outcomeFromWinner, outcomeIfFinished, scorePrediction } from './scorer';

function fdMatch(status: FdMatchStatus, winner: FdMatchWinner): FdMatch {
  return {
    id: 1,
    utcDate: '2026-01-08T15:00:00Z',
    status,
    matchday: 1,
    homeTeam: { id: 10, name: 'Home FC' },
    awayTeam: { id: 20, name: 'Away FC' },
    score: { winner },
  };
}

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

describe('outcomeIfFinished', () => {
  it.each([
    ['HOME_TEAM', 'HOME'],
    ['AWAY_TEAM', 'AWAY'],
    ['DRAW', 'DRAW'],
  ] as const)('FINISHED with winner=%s -> %s', (winner, expected) => {
    expect(outcomeIfFinished(fdMatch('FINISHED', winner))).toBe(expected);
  });

  it('is null for a FINISHED match with no winner yet', () => {
    expect(outcomeIfFinished(fdMatch('FINISHED', null))).toBeNull();
  });

  it.each(['TIMED', 'IN_PLAY', 'PAUSED', 'POSTPONED', 'CANCELLED'] as const)(
    'is null while status is %s',
    (status) => {
      expect(outcomeIfFinished(fdMatch(status, 'HOME_TEAM'))).toBeNull();
    },
  );
});
