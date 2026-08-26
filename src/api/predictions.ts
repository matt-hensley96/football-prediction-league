import type { Env, FixtureRow, GameweekRow, Outcome } from '../types';
import { getAuthedUser } from './auth';
import { json } from '../utils/http';

const VALID_PICKS: readonly Outcome[] = ['HOME', 'AWAY', 'DRAW'];

export async function getCurrentGameweek(request: Request, env: Env): Promise<Response> {
  const gameweek = await env.DB.prepare(
    "SELECT * FROM gameweeks WHERE status IN ('open', 'locked') ORDER BY matchday DESC LIMIT 1",
  ).first<GameweekRow>();

  if (!gameweek) {
    return json({ gameweek: null, fixtures: [], picks: {} });
  }

  const fixtures = await env.DB.prepare('SELECT * FROM fixtures WHERE gameweek_id = ?')
    .bind(gameweek.id)
    .all<FixtureRow>();

  const user = await getAuthedUser(request, env);
  let picks: Record<number, Outcome> = {};

  if (user) {
    const rows = await env.DB.prepare(
      `SELECT fixture_id, pick FROM predictions
       WHERE user_id = ? AND fixture_id IN (SELECT id FROM fixtures WHERE gameweek_id = ?)`,
    )
      .bind(user.id, gameweek.id)
      .all<{ fixture_id: number; pick: Outcome }>();

    picks = Object.fromEntries(rows.results.map((r) => [r.fixture_id, r.pick]));
  }

  return json({
    gameweek,
    fixtures: fixtures.results,
    picks,
    isOpen: gameweek.status === 'open' && new Date(gameweek.deadline) > new Date(),
  });
}

interface PickInput {
  fixtureId?: number;
  pick?: string;
}

interface SubmitPredictionsBody {
  picks?: PickInput[];
}

export async function submitPredictions(request: Request, env: Env): Promise<Response> {
  const user = await getAuthedUser(request, env);

  if (!user) {
    return json({ error: 'Not logged in' }, 401);
  }

  const body = await request.json<SubmitPredictionsBody>();
  const picks = body.picks;

  if (!Array.isArray(picks) || picks.length === 0) {
    return json({ error: 'picks must be a non-empty array' }, 400);
  }

  const invalid = picks.some((p) => !p.fixtureId || !p.pick || !VALID_PICKS.includes(p.pick as Outcome));

  if (invalid) {
    return json({ error: 'Each pick needs a fixtureId and a valid pick (HOME, AWAY, DRAW)' }, 400);
  }

  const fixtureIds = picks.map((p) => p.fixtureId as number);
  const placeholders = fixtureIds.map(() => '?').join(', ');

  const fixtureRows = await env.DB.prepare(
    `SELECT f.id, g.status AS gameweek_status, g.deadline AS gameweek_deadline
     FROM fixtures f JOIN gameweeks g ON g.id = f.gameweek_id
     WHERE f.id IN (${placeholders})`,
  )
    .bind(...fixtureIds)
    .all<{ id: number; gameweek_status: string; gameweek_deadline: string }>();

  if (fixtureRows.results.length !== fixtureIds.length) {
    return json({ error: 'Unknown fixture' }, 404);
  }

  const now = new Date();
  const anyClosed = fixtureRows.results.some((f) => f.gameweek_status !== 'open' || new Date(f.gameweek_deadline) <= now);

  if (anyClosed) {
    return json({ error: 'Predictions are closed for this gameweek' }, 403);
  }

  const statements = picks.map((p) =>
    env.DB.prepare(
      `INSERT INTO predictions (user_id, fixture_id, pick) VALUES (?, ?, ?)
       ON CONFLICT (user_id, fixture_id) DO UPDATE SET pick = excluded.pick, points_awarded = NULL`,
    ).bind(user.id, p.fixtureId, p.pick),
  );

  await env.DB.batch(statements);

  return json({ ok: true });
}
