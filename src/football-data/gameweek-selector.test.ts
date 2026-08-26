import { describe, expect, it } from 'vitest';
import { pickTopTeamExcludingManUtdAndLeeds } from './gameweek-selector';
import type { FdStandingRow } from './types';

function team(id: number, name: string): FdStandingRow['team'] {
  return { id, name };
}

describe('pickTopTeamExcludingManUtdAndLeeds', () => {
  it('picks the outright top team when it is neither Man Utd nor Leeds', () => {
    const table: FdStandingRow[] = [
      { position: 1, team: team(1, 'Arsenal FC') },
      { position: 2, team: team(2, 'Manchester United FC') },
      { position: 3, team: team(3, 'Leeds United FC') },
    ];

    expect(pickTopTeamExcludingManUtdAndLeeds(table)).toEqual(team(1, 'Arsenal FC'));
  });

  it('skips Man Utd when Man Utd is top', () => {
    const table: FdStandingRow[] = [
      { position: 1, team: team(1, 'Manchester United FC') },
      { position: 2, team: team(2, 'Liverpool FC') },
    ];

    expect(pickTopTeamExcludingManUtdAndLeeds(table)).toEqual(team(2, 'Liverpool FC'));
  });

  it('skips both Man Utd and Leeds when they occupy the top two spots', () => {
    const table: FdStandingRow[] = [
      { position: 1, team: team(1, 'Leeds United FC') },
      { position: 2, team: team(2, 'Manchester United FC') },
      { position: 3, team: team(3, 'Chelsea FC') },
    ];

    expect(pickTopTeamExcludingManUtdAndLeeds(table)).toEqual(team(3, 'Chelsea FC'));
  });

  it('throws when every team is excluded', () => {
    const table: FdStandingRow[] = [
      { position: 1, team: team(1, 'Manchester United FC') },
      { position: 2, team: team(2, 'Leeds United FC') },
    ];

    expect(() => pickTopTeamExcludingManUtdAndLeeds(table)).toThrow();
  });
});
