export interface Env {
  DB: D1Database;
  FOOTBALL_DATA_TOKEN: string;
  RESEND_API_KEY: string;
  EMAIL_FROM: string;
  APP_URL: string;
}

export type Outcome = 'HOME' | 'AWAY' | 'DRAW';

export type GameweekStatus = 'open' | 'locked' | 'scored';

export interface GameweekRow {
  id: number;
  matchday: number;
  deadline: string;
  status: GameweekStatus;
}

export interface FixtureRow {
  id: number;
  gameweek_id: number;
  home_team: string;
  away_team: string;
  kickoff_time: string;
  pl_match_id: number;
  result: Outcome | null;
}

export interface PredictionRow {
  id: number;
  user_id: number;
  fixture_id: number;
  pick: Outcome;
  points_awarded: number | null;
}

export interface UserRow {
  id: number;
  name: string;
  pin_hash: string;
  is_system: number;
  email: string | null;
}
