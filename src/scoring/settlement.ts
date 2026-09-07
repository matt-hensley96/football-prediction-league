import type { Outcome } from '../types';

export interface FixtureSettlementState {
  result: Outcome | null;
  voided: boolean;
}

/**
 * A gameweek is settled once every fixture either has a result or has been voided (see
 * voided_fixtures). The length guard stops a gameweek with no fixtures being marked scored.
 */
export function gameweekIsSettled(fixtures: FixtureSettlementState[]): boolean {
  return fixtures.length > 0 && fixtures.every((f) => f.result !== null || f.voided);
}
