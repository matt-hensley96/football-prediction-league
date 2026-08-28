import type { FootballDataClient } from '../football-data/client';
import type { Env } from '../types';
import { sendEmail } from '../utils/email';
import { escapeHtml } from '../utils/html';

export interface FinalStandingRow {
  user_id: number;
  name: string;
  email: string | null;
  points: number;
}

export function hasSeasonEnded(seasonEndDate: string, now: Date): boolean {
  return now.getTime() >= new Date(seasonEndDate).getTime();
}

export function getWinners(standings: FinalStandingRow[]): FinalStandingRow[] {
  const highestPoints = Math.max(...standings.map((row) => row.points));

  return standings.filter((row) => row.points === highestPoints);
}

export function buildSeasonSummaryEmailHtml(
  standings: FinalStandingRow[],
  winners: FinalStandingRow[],
  recipientName: string,
): string {
  const rows = standings
    .map((row, index) => `<li>${index + 1}. ${escapeHtml(row.name)} - ${row.points} pts</li>`)
    .join('');

  const winnerNames = winners.map((winner) => escapeHtml(winner.name)).join(' &amp; ');

  return (
    `<p>Hi ${escapeHtml(recipientName)}, the season is over - here's the final table.</p>` +
    `<ol>${rows}</ol>` +
    `<p>Congratulations to ${winnerNames} on winning the league!</p>`
  );
}

export async function checkAndSendSeasonSummary(env: Env, client: FootballDataClient): Promise<void> {
  const pendingGameweek = await env.DB.prepare("SELECT 1 FROM gameweeks WHERE status != 'scored' LIMIT 1").first();

  if (pendingGameweek) {
    return;
  }

  const { season } = await client.getStandings();

  if (!hasSeasonEnded(season.endDate, new Date())) {
    return;
  }

  const alreadySent = await env.DB.prepare('SELECT 1 FROM season_summaries WHERE season_end_date = ?')
    .bind(season.endDate)
    .first();

  if (alreadySent) {
    return;
  }

  const standings = await env.DB.prepare(
    `SELECT u.id AS user_id, u.name AS name, u.email AS email, COALESCE(SUM(p.points_awarded), 0) AS points
     FROM users u
     LEFT JOIN predictions p ON p.user_id = u.id AND p.points_awarded IS NOT NULL
     WHERE u.is_system = 0 AND u.deactivated_at IS NULL
     GROUP BY u.id
     ORDER BY points DESC, u.name ASC`,
  ).all<FinalStandingRow>();

  await sendSeasonSummaryEmails(env, standings.results);

  await env.DB.prepare('INSERT INTO season_summaries (season_end_date) VALUES (?)').bind(season.endDate).run();
}

async function sendSeasonSummaryEmails(env: Env, standings: FinalStandingRow[]): Promise<void> {
  const winners = getWinners(standings);

  for (const player of standings) {
    if (!player.email) {
      continue;
    }

    const html = buildSeasonSummaryEmailHtml(standings, winners, player.name);

    await sendEmail(env, player.email, 'Final league table & season wrap-up', html).catch((err) => {
      console.error(`Failed to email season summary to ${player.name}:`, err);
    });
  }
}
