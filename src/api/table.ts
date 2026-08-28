import type { Env } from '../types';
import { json } from '../utils/http';

interface StandingRow {
  name: string;
  points: number;
  is_system: number;
}

export async function getLeagueTable(env: Env): Promise<Response> {
  const rows = await env.DB.prepare(
    `SELECT u.name AS name, u.is_system AS is_system, COALESCE(SUM(p.points_awarded), 0) AS points
     FROM users u
     LEFT JOIN predictions p ON p.user_id = u.id AND p.points_awarded IS NOT NULL
     WHERE u.deactivated_at IS NULL
     GROUP BY u.id
     ORDER BY points DESC, u.name COLLATE NOCASE ASC`,
  ).all<StandingRow>();

  return json({ standings: rows.results });
}
