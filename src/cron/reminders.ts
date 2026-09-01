import type { Env, GameweekRow } from '../types';
import { sendEmail } from '../utils/email';

const REMINDER_LEAD_HOURS = 36;
const REMINDER_KIND = '24h';

export function isReminderDue(now: Date, deadline: Date, hoursBefore: number): boolean {
  return now.getTime() >= deadline.getTime() - hoursBefore * 60 * 60 * 1000;
}

export async function checkAndSendReminders(env: Env): Promise<void> {
  const gameweek = await env.DB.prepare("SELECT * FROM gameweeks WHERE status = 'open' LIMIT 1").first<GameweekRow>();

  if (!gameweek) {
    return;
  }

  if (!isReminderDue(new Date(), new Date(gameweek.deadline), REMINDER_LEAD_HOURS)) {
    return;
  }

  const alreadySent = await env.DB.prepare('SELECT 1 FROM gameweek_reminders WHERE gameweek_id = ? AND kind = ?')
    .bind(gameweek.id, REMINDER_KIND)
    .first();

  if (alreadySent) {
    return;
  }

  await sendMissingPickReminders(env, gameweek);

  await env.DB.prepare('INSERT INTO gameweek_reminders (gameweek_id, kind) VALUES (?, ?)')
    .bind(gameweek.id, REMINDER_KIND)
    .run();
}

async function sendMissingPickReminders(env: Env, gameweek: GameweekRow): Promise<void> {
  const missingPicks = await env.DB.prepare(
    `SELECT u.name AS name, u.email AS email
     FROM users u
     WHERE u.is_system = 0
     AND u.deactivated_at IS NULL
     AND u.id NOT IN (
       SELECT p.user_id
       FROM predictions p
       WHERE p.fixture_id IN (SELECT id FROM fixtures WHERE gameweek_id = ?)
       GROUP BY p.user_id
       HAVING COUNT(DISTINCT p.fixture_id) = (SELECT COUNT(*) FROM fixtures WHERE gameweek_id = ?)
     )`,
  )
    .bind(gameweek.id, gameweek.id)
    .all<{ name: string; email: string | null }>();

  for (const player of missingPicks.results) {
    if (!player.email) {
      continue;
    }

    const html = buildReminderEmailHtml(gameweek, env.APP_URL);

    await sendEmail(env, player.email, `Don't forget: Gameweek ${gameweek.matchday} predictions`, html).catch((err) => {
      console.error(`Failed to email reminder to ${player.name}:`, err);
    });
  }
}

function buildReminderEmailHtml(gameweek: GameweekRow, appUrl: string): string {
  const deadline = new Date(gameweek.deadline).toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/London',
  });

  return (
    `<p>The deadline for Gameweek ${gameweek.matchday} is ${deadline}.</p>` +
    `<p><a href="${appUrl}">Click here to submit your predictions!</a></p>`
  );
}