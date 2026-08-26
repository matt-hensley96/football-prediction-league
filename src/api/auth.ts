import type { Env, UserRow } from '../types';
import { sha256Hex } from '../utils/crypto';
import { json } from '../utils/http';

interface LoginBody {
  name?: string;
  pin?: string;
}

const RESERVED_NAMES = new Set(['cpu']);
const MAX_PLAYERS = 10;
const USERNAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{2,19}$/;

export async function handleLogin(request: Request, env: Env): Promise<Response> {
  const body = await request.json<LoginBody>();

  if (!body.name || !body.pin) {
    return json({ error: 'username and pin are required' }, 400);
  }

  const user = await env.DB.prepare('SELECT id, name, pin_hash, is_system FROM users WHERE name = ?')
    .bind(body.name)
    .first<UserRow>();

  const pinHash = await sha256Hex(body.pin);

  if (!user || user.is_system || user.pin_hash !== pinHash) {
    return json({ error: 'Invalid username or PIN' }, 401);
  }

  const token = await createSession(env, user.id);

  return json({ token, name: user.name });
}

interface SignupBody {
  name?: string;
  pin?: string;
  email?: string;
}

export async function handleSignup(request: Request, env: Env): Promise<Response> {
  const body = await request.json<SignupBody>();
  const name = body.name?.trim();
  const pin = body.pin?.trim();
  const email = body.email?.trim().toLowerCase();

  if (!name || !pin || !email) {
    return json({ error: 'username, pin, and email are required' }, 400);
  }

  if (!USERNAME_PATTERN.test(name)) {
    return json(
      {
        error:
          'Username must be 3-20 characters, start with a letter, and contain only letters, numbers, underscores, and hyphens',
      },
      400,
    );
  }

  if (RESERVED_NAMES.has(name.toLowerCase())) {
    return json({ error: 'That username is reserved' }, 400);
  }

  const existing = await env.DB.prepare('SELECT id FROM users WHERE name = ?').bind(name).first();

  if (existing) {
    return json({ error: 'That username is already taken' }, 409);
  }

  const playerCount = await env.DB.prepare('SELECT COUNT(*) AS count FROM users WHERE is_system = 0')
    .first<{ count: number }>();

  if ((playerCount?.count ?? 0) >= MAX_PLAYERS) {
    return json({ error: 'Signups are full' }, 409);
  }

  const pinHash = await sha256Hex(pin);

  let inserted: { id: number } | null;

  try {
    inserted = await env.DB.prepare('INSERT INTO users (name, pin_hash, email) VALUES (?, ?, ?) RETURNING id')
      .bind(name, pinHash, email)
      .first<{ id: number }>();
  } catch (err) {
    const message = err instanceof Error ? err.message : '';

    if (message.includes('UNIQUE constraint failed')) {
      return json({ error: 'That email is already registered to another account' }, 409);
    }

    throw err;
  }

  if (!inserted) {
    return json({ error: 'Failed to create account' }, 500);
  }

  const token = await createSession(env, inserted.id);

  return json({ token, name });
}

async function createSession(env: Env, userId: number): Promise<string> {
  const token = crypto.randomUUID();

  await env.DB.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').bind(token, userId).run();

  return token;
}

export interface AuthedUser {
  id: number;
  name: string;
}

export async function getAuthedUser(request: Request, env: Env): Promise<AuthedUser | null> {
  const header = request.headers.get('Authorization');

  if (!header?.startsWith('Bearer ')) {
    return null;
  }

  const token = header.slice('Bearer '.length);

  const row = await env.DB.prepare(
    'SELECT u.id AS id, u.name AS name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?',
  )
    .bind(token)
    .first<AuthedUser>();

  return row ?? null;
}
