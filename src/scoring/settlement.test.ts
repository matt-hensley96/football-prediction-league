import { describe, expect, it } from 'vitest';
import { gameweekIsSettled } from './settlement';

describe('gameweekIsSettled', () => {
  it('is true when every fixture has a result', () => {
    expect(
      gameweekIsSettled([
        { result: 'HOME', voided: false },
        { result: 'DRAW', voided: false },
        { result: 'AWAY', voided: false },
      ]),
    ).toBe(true);
  });

  it('is false when a fixture is neither played nor voided', () => {
    expect(
      gameweekIsSettled([
        { result: 'HOME', voided: false },
        { result: null, voided: false },
        { result: 'AWAY', voided: false },
      ]),
    ).toBe(false);
  });

  it('is true when the only pending fixture has been voided', () => {
    expect(
      gameweekIsSettled([
        { result: 'HOME', voided: false },
        { result: null, voided: true },
        { result: 'AWAY', voided: false },
      ]),
    ).toBe(true);
  });

  it('is true when every fixture has been voided', () => {
    expect(
      gameweekIsSettled([
        { result: null, voided: true },
        { result: null, voided: true },
        { result: null, voided: true },
      ]),
    ).toBe(true);
  });

  it('is false for a gameweek with no fixtures', () => {
    expect(gameweekIsSettled([])).toBe(false);
  });
});
