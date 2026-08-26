import type { Env } from '../types';
import { sha256Hex } from '../utils/crypto';
import { sendEmail } from '../utils/email';
import { json } from '../utils/http';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

interface ForgotPinBody {
  email?: string;
}

export async function handleForgotPin(request: Request, env: Env): Promise<Response> {
  const body = await request.json<ForgotPinBody>();
  const email = body.email?.trim().toLowerCase();

  if (!email) {
    return json({ error: 'email is required' }, 400);
  }

  const user = await env.DB.prepare('SELECT id, name FROM users WHERE email = ? AND is_system = 0')
    .bind(email)
    .first<{ id: number; name: string }>();

  if (user) {
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();

    await env.DB.prepare('INSERT INTO pin_resets (token, user_id, expires_at) VALUES (?, ?, ?)')
      .bind(token, user.id, expiresAt)
      .run();

    const resetUrl = new URL(request.url);
    resetUrl.pathname = '/';
    resetUrl.search = `?resetToken=${token}`;

    await sendEmail(
      env,
      email,
      'Reset your Predictor PIN',
      `<p>Hi ${user.name},</p><p>Click below to set a new PIN. This link expires in 1 hour.</p>` +
        `<p><a href="${resetUrl.toString()}">${resetUrl.toString()}</a></p>` +
        `<p>If you didn't ask for this, you can ignore this email.</p>`,
    );
  }

  return json({ ok: true });
}

interface ResetPinBody {
  token?: string;
  pin?: string;
}

export async function handleResetPin(request: Request, env: Env): Promise<Response> {
  const body = await request.json<ResetPinBody>();
  const token = body.token?.trim();
  const pin = body.pin?.trim();

  if (!token || !pin) {
    return json({ error: 'token and pin are required' }, 400);
  }

  const reset = await env.DB.prepare('SELECT user_id, expires_at, used_at FROM pin_resets WHERE token = ?')
    .bind(token)
    .first<{ user_id: number; expires_at: string; used_at: string | null }>();

  if (!reset || reset.used_at || new Date(reset.expires_at) <= new Date()) {
    return json({ error: 'That reset link is invalid or has expired' }, 400);
  }

  const pinHash = await sha256Hex(pin);

  await env.DB.batch([
    env.DB.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').bind(pinHash, reset.user_id),
    env.DB.prepare("UPDATE pin_resets SET used_at = datetime('now') WHERE token = ?").bind(token),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(reset.user_id),
  ]);

  return json({ ok: true });
}
