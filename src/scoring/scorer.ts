import type { Outcome } from '../types';
import type { FdMatch, FdMatchWinner } from '../football-data/types';

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

export function outcomeIfFinished(match: FdMatch): Outcome | null {
  if (match.status !== 'FINISHED') {
    return null;
  }

  return outcomeFromWinner(match.score.winner);
}

/**
 * Statuses that mean a match will not produce a result we can score. SUSPENDED is included
 * even though such a match is sometimes resumed later - the point is to never let one block
 * its gameweek from settling, and a voided fixture stays voided.
 */
const UNPLAYABLE_STATUSES = ['POSTPONED', 'CANCELLED', 'SUSPENDED'] as const;

export type VoidReason = (typeof UNPLAYABLE_STATUSES)[number];

export function voidReasonIfUnplayable(match: FdMatch): VoidReason | null {
  return (UNPLAYABLE_STATUSES as readonly string[]).includes(match.status)
    ? (match.status as VoidReason)
    : null;
}
