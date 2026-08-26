import type { Env, FixtureRow, GameweekRow, Outcome } from '../types';
import { json } from '../utils/http';

interface PickRow {
  name: string;
  fixture_id: number;
  pick: Outcome;
  points_awarded: number | null;
}

export async function getHistory(env: Env): Promise<Response> {
  const gameweeks = await env.DB.prepare(
    "SELECT * FROM gameweeks WHERE status = 'scored' ORDER BY matchday DESC",
  ).all<GameweekRow>();

  const history = [];

  for (const gameweek of gameweeks.results) {
    const fixtures = await env.DB.prepare('SELECT * FROM fixtures WHERE gameweek_id = ?')
      .bind(gameweek.id)
      .all<FixtureRow>();

    const picks = await env.DB.prepare(
      `SELECT u.name AS name, p.fixture_id AS fixture_id, p.pick AS pick, p.points_awarded AS points_awarded
       FROM predictions p
       JOIN users u ON u.id = p.user_id
       WHERE p.fixture_id IN (SELECT id FROM fixtures WHERE gameweek_id = ?)`,
    )
      .bind(gameweek.id)
      .all<PickRow>();

    history.push({ gameweek, fixtures: fixtures.results, picks: picks.results });
  }

  return json({ history });
}
