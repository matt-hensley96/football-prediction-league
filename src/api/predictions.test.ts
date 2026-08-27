import { describe, expect, it } from 'vitest';
import { isPredictionSetComplete } from './predictions';

describe('isPredictionSetComplete', () => {
  it('is complete when every fixture in the gameweek has a pick', () => {
    expect(isPredictionSetComplete([10, 11, 12], 3)).toBe(true);
  });

  it('is incomplete when a fixture is missing a pick', () => {
    expect(isPredictionSetComplete([10, 11], 3)).toBe(false);
  });

  it('is incomplete when no picks are supplied', () => {
    expect(isPredictionSetComplete([], 3)).toBe(false);
  });

  it('counts distinct fixtures only, so duplicates do not fake completeness', () => {
    expect(isPredictionSetComplete([10, 10, 11], 3)).toBe(false);
  });
});
