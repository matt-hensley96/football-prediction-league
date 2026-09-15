import type { Outcome } from '../types';
import type { FdMatch, FdStandingsResponse } from './types';

// CPU chooses a prediction based on which team is currently higher in the league.
// Home advantage applied by pretending the home team is 'HOME_ADVANTAGE_POSITIONS' higher than they really are.
// CPU predicts a draw if the teams are within 'DRAW_MARGIN_POSITIONS' apart after home advantage is applied.
const HOME_ADVANTAGE_POSITIONS = 4;
const DRAW_MARGIN_POSITIONS = 3;

export function getCpuPrediction(match: FdMatch, standings: FdStandingsResponse): Outcome {
  const homePosition = getLeagueTablePosition(match.homeTeam.id, standings);
  const awayPosition = getLeagueTablePosition(match.awayTeam.id, standings);

  if (homePosition === null || awayPosition === null) {
    return 'HOME';
  }

  const effectiveHomePosition = Math.max(1, homePosition - HOME_ADVANTAGE_POSITIONS);

  if (Math.abs(effectiveHomePosition - awayPosition) <= DRAW_MARGIN_POSITIONS) {
    return 'DRAW';
  }

  return effectiveHomePosition < awayPosition ? 'HOME' : 'AWAY';
}

function getLeagueTablePosition(teamId: number, standings: FdStandingsResponse): number | null {
  const totalTable = standings.standings.find((s) => s.type === 'TOTAL')?.table ?? [];

  return totalTable.find((row) => row.team.id === teamId)?.position ?? null;
}