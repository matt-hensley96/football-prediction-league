import { describe, expect, it } from 'vitest';
import { getCpuPrediction } from './cpu-picker';
import type { FdMatch, FdStandingsResponse } from './types';

function match(homeId: number, awayId: number): FdMatch {
  return {
    id: 1,
    utcDate: '2026-01-01T15:00:00Z',
    status: 'SCHEDULED',
    matchday: 6,
    homeTeam: { id: homeId, name: `Team ${homeId}` },
    awayTeam: { id: awayId, name: `Team ${awayId}` },
    score: { winner: null },
  };
}

function standingsWithPositions(positions: Record<number, number>): FdStandingsResponse {
  return {
    season: { startDate: '2025-08-01', endDate: '2026-05-24', currentMatchday: 6 },
    standings: [
      {
        type: 'TOTAL',
        table: Object.entries(positions).map(([teamId, position]) => ({
          position,
          team: { id: Number(teamId), name: `Team ${teamId}` },
        })),
      },
    ],
  };
}

describe('getCpuPrediction', () => {
  it('picks HOME when the home team is far higher in the table than the away team', () => {
    const standings = standingsWithPositions({ 1: 1, 2: 20 });

    expect(getCpuPrediction(match(1, 2), standings)).toBe('HOME');
  });

  it('picks AWAY when the away team is high enough in the table to overcome home advantage', () => {
    const standings = standingsWithPositions({ 1: 20, 2: 1 });

    expect(getCpuPrediction(match(1, 2), standings)).toBe('AWAY');
  });

  it('picks DRAW when the teams are close together once home advantage is applied', () => {
    const standings = standingsWithPositions({ 1: 10, 2: 6 });

    expect(getCpuPrediction(match(1, 2), standings)).toBe('DRAW');
  });

  it('falls back to HOME when a team is missing from the standings table', () => {
    const standings = standingsWithPositions({ 1: 1 });

    expect(getCpuPrediction(match(1, 2), standings)).toBe('HOME');
  });
});
