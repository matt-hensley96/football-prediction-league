import type { Outcome } from '../types';
import type { FdMatchWinner } from '../football-data/types';

/**
 * 3 points for a correct result, -1 for calling a win that was actually a
 * loss (or vice versa), 0 for any other miss (e.g. predicting a win that
 * ended in a draw).
 */
export function scorePrediction(pick: Outcome, actual: Outcome): number {
  if (pick === actual) {
    return 3;
  }

  const isOppositeWinLoss =
    (pick === 'HOME' && actual === 'AWAY') || (pick === 'AWAY' && actual === 'HOME');

  return isOppositeWinLoss ? -1 : 0;
}

export function outcomeFromWinner(winner: FdMatchWinner): Outcome | null {
  if (winner === 'HOME_TEAM') return 'HOME';
  if (winner === 'AWAY_TEAM') return 'AWAY';
  if (winner === 'DRAW') return 'DRAW';

  return null;
}
