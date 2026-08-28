import type { Env, FixtureRow, GameweekRow, Outcome } from '../types';
import { sendEmail } from '../utils/email';
import { escapeHtml } from '../utils/html';

export interface GameweekPickRow {
  user_id: number;
  name: string;
  email: string | null;
  fixture_id: number;
  pick: Outcome;
  points_awarded: number | null;
}

export interface PlayerGameweekResult {
  name: string;
  email: string | null;
  picks: GameweekPickRow[];
  totalPoints: number;
}

export function groupPicksByUser(picks: GameweekPickRow[]): PlayerGameweekResult[] {
  const byUser = new Map<number, PlayerGameweekResult>();

  for (const pick of picks) {
    let player = byUser.get(pick.user_id);

    if (!player) {
      player = { name: pick.name, email: pick.email, picks: [], totalPoints: 0 };
      byUser.set(pick.user_id, player);
    }

    player.picks.push(pick);
    player.totalPoints += pick.points_awarded ?? 0;
  }

  return [...byUser.values()];
}

export function buildResultsEmailHtml(gameweek: GameweekRow, fixtures: FixtureRow[], player: PlayerGameweekResult): string {
  const rows = fixtures
    .map((fixture) => {
      const pick = player.picks.find((p) => p.fixture_id === fixture.id);
      const pickLabel = pick ? pick.pick : 'nothing';
      const points = pick?.points_awarded ?? 0;

      return `<li>${escapeHtml(fixture.home_team)} vs ${escapeHtml(fixture.away_team)} - ` +
        `result: ${fixture.result ?? 'N/A'}, you picked ${pickLabel} (${points} pts)</li>`;
    })
    .join('');

  return (
    `<p>Gameweek ${gameweek.matchday} is fully settled. Total points: ${player.totalPoints}</p>` +
    `<ul>${rows}</ul>`
  );
}

export async function sendGameweekResultsEmails(
  env: Env,
  gameweek: GameweekRow,
  fixtures: FixtureRow[],
  picks: GameweekPickRow[],
): Promise<void> {
  const players = groupPicksByUser(picks);

  for (const player of players) {
    if (!player.email) {
      continue;
    }

    const html = buildResultsEmailHtml(gameweek, fixtures, player);

    await sendEmail(env, player.email, `Matchday ${gameweek.matchday} results`, html).catch((err) => {
      console.error(`Failed to email results to ${player.name}:`, err);
    });
  }
}
