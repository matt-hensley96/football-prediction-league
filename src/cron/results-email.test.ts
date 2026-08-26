import { describe, expect, it } from 'vitest';
import { buildResultsEmailHtml, groupPicksByUser } from './results-email';
import type { GameweekPickRow } from './results-email';
import type { FixtureRow, GameweekRow } from '../types';

const gameweek: GameweekRow = { id: 1, matchday: 5, deadline: '2026-01-01T00:00:00Z', status: 'scored' };

const fixtures: FixtureRow[] = [
  {
    id: 10,
    gameweek_id: 1,
    category: 'man_utd',
    home_team: 'Man Utd',
    away_team: 'Arsenal',
    kickoff_time: '2026-01-01T15:00:00Z',
    pl_match_id: 100,
    result: 'HOME',
  },
];

describe('groupPicksByUser', () => {
  it('groups picks by user and sums points awarded', () => {
    const picks: GameweekPickRow[] = [
      { user_id: 1, name: 'Alice', email: 'alice@example.com', fixture_id: 10, pick: 'HOME', points_awarded: 3 },
      { user_id: 2, name: 'Bob', email: null, fixture_id: 10, pick: 'AWAY', points_awarded: -1 },
    ];

    const [alice, bob] = groupPicksByUser(picks);

    expect(alice).toMatchObject({ name: 'Alice', email: 'alice@example.com', totalPoints: 3 });
    expect(bob).toMatchObject({ name: 'Bob', email: null, totalPoints: -1 });
  });

  it('treats a null points_awarded as zero when summing', () => {
    const picks: GameweekPickRow[] = [
      { user_id: 1, name: 'Alice', email: 'alice@example.com', fixture_id: 10, pick: 'HOME', points_awarded: null },
    ];

    const [alice] = groupPicksByUser(picks);

    expect(alice?.totalPoints).toBe(0);
  });
});

describe('buildResultsEmailHtml', () => {
  it("includes the fixture result, the player's pick, and their total", () => {
    const player = {
      name: 'Alice',
      email: 'alice@example.com',
      picks: [{ user_id: 1, name: 'Alice', email: 'alice@example.com', fixture_id: 10, pick: 'HOME', points_awarded: 3 }] as GameweekPickRow[],
      totalPoints: 3,
    };

    const html = buildResultsEmailHtml(gameweek, fixtures, player);

    expect(html).toContain('matchday 5');
    expect(html).toContain('Man Utd vs Arsenal');
    expect(html).toContain('result: HOME');
    expect(html).toContain('you picked HOME (3 pts)');
    expect(html).toContain('Total points this gameweek: 3');
  });

  it("shows 'nothing' when the player didn't pick a fixture", () => {
    const player = { name: 'Bob', email: 'bob@example.com', picks: [], totalPoints: 0 };
    const html = buildResultsEmailHtml(gameweek, fixtures, player);

    expect(html).toContain('you picked nothing (0 pts)');
  });
});
