import { describe, expect, it } from 'vitest';
import { buildSeasonSummaryEmailHtml, getWinners, hasSeasonEnded } from './season-summary';
import type { FinalStandingRow } from './season-summary';

describe('hasSeasonEnded', () => {
  const endDate = '2026-05-24';

  it('is false before the season end date', () => {
    expect(hasSeasonEnded(endDate, new Date('2026-05-01T00:00:00Z'))).toBe(false);
  });

  it('is true on the season end date', () => {
    expect(hasSeasonEnded(endDate, new Date('2026-05-24T12:00:00Z'))).toBe(true);
  });

  it('is true after the season end date', () => {
    expect(hasSeasonEnded(endDate, new Date('2026-06-01T00:00:00Z'))).toBe(true);
  });
});

describe('getWinners', () => {
  it('returns the single player with the most points', () => {
    const standings: FinalStandingRow[] = [
      { user_id: 1, name: 'Alice', email: 'alice@example.com', points: 42 },
      { user_id: 2, name: 'Bob', email: 'bob@example.com', points: 30 },
    ];

    expect(getWinners(standings)).toEqual([standings[0]]);
  });

  it('returns every player tied for the most points', () => {
    const standings: FinalStandingRow[] = [
      { user_id: 1, name: 'Alice', email: 'alice@example.com', points: 42 },
      { user_id: 2, name: 'Bob', email: 'bob@example.com', points: 42 },
      { user_id: 3, name: 'Carol', email: 'carol@example.com', points: 10 },
    ];

    expect(getWinners(standings)).toEqual([standings[0], standings[1]]);
  });
});

describe('buildSeasonSummaryEmailHtml', () => {
  const alice: FinalStandingRow = { user_id: 1, name: 'Alice', email: 'alice@example.com', points: 42 };
  const bob: FinalStandingRow = { user_id: 2, name: 'Bob', email: 'bob@example.com', points: 30 };
  const standings: FinalStandingRow[] = [alice, bob];

  it('lists every player in rank order with their points', () => {
    const html = buildSeasonSummaryEmailHtml(standings, [alice], 'Bob');

    expect(html).toContain('1. Alice - 42 pts');
    expect(html).toContain('2. Bob - 30 pts');
  });

  it('greets the recipient by name', () => {
    const html = buildSeasonSummaryEmailHtml(standings, [alice], 'Bob');

    expect(html).toContain('Hi Bob');
  });

  it('congratulates a single winner by name', () => {
    const html = buildSeasonSummaryEmailHtml(standings, [alice], 'Bob');

    expect(html).toContain('Congratulations to Alice on winning the league!');
  });

  it('congratulates every tied winner', () => {
    const html = buildSeasonSummaryEmailHtml(standings, [alice, bob], 'Bob');

    expect(html).toContain('Congratulations to Alice &amp; Bob on winning the league!');
  });
});
