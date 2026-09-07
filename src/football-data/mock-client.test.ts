import { describe, expect, it } from 'vitest';
import { MockFootballDataClient } from './mock-client';
import { MOCK_MATCHES, MOCK_SEASON_END_DATE } from './mock-data';
import { nextMockAction } from './mock-state';
import type { Env } from '../types';

function envWithFinishedCount(finishedCount: number): Env {
  const stub = {
    run: async () => ({}),
    bind: () => stub,
    first: async () => ({ finished_count: finishedCount }),
  };

  return { DB: { prepare: () => stub } } as unknown as Env;
}

const firstMatch = MOCK_MATCHES[0]!;
const secondMatch = MOCK_MATCHES[1]!;
const unplayableMatch = MOCK_MATCHES.find((m) => m.unplayable)!;
const unplayableIndex = MOCK_MATCHES.indexOf(unplayableMatch);

describe('MockFootballDataClient.getMatch', () => {
  it('reports a match as SCHEDULED while its position is at or above finished_count', async () => {
    const client = new MockFootballDataClient(envWithFinishedCount(1));

    const match = await client.getMatch(secondMatch.id);

    expect(match.status).toBe('SCHEDULED');
    expect(match.score.winner).toBeNull();
  });

  it('reports a match as FINISHED with its fixed winner once its position is below finished_count', async () => {
    const client = new MockFootballDataClient(envWithFinishedCount(1));

    const match = await client.getMatch(firstMatch.id);

    expect(match.status).toBe('FINISHED');
    expect(match.score.winner).toBe(firstMatch.winner);
  });

  it('reports an unplayable match with its status and no winner once its position is below finished_count', async () => {
    const client = new MockFootballDataClient(envWithFinishedCount(unplayableIndex + 1));

    const match = await client.getMatch(unplayableMatch.id);

    expect(match.status).toBe(unplayableMatch.unplayable);
    expect(match.score.winner).toBeNull();
  });

  it('throws for an unknown match id', async () => {
    const client = new MockFootballDataClient(envWithFinishedCount(0));

    await expect(client.getMatch(123456)).rejects.toThrow('no such mock match');
  });
});

describe('MockFootballDataClient.getScheduledMatches', () => {
  it('omits matches that have already finished and dates the rest in the future', async () => {
    const client = new MockFootballDataClient(envWithFinishedCount(4));

    const { matches } = await client.getScheduledMatches();

    expect(matches).toHaveLength(MOCK_MATCHES.length - 4);
    expect(matches.every((m) => m.status === 'SCHEDULED')).toBe(true);
    expect(matches.every((m) => new Date(m.utcDate).getTime() > Date.now())).toBe(true);
  });
});

describe('MockFootballDataClient.getStandings', () => {
  it('returns the far-future mock season end date', async () => {
    const client = new MockFootballDataClient(envWithFinishedCount(0));

    const standings = await client.getStandings();

    expect(standings.season.endDate).toBe(MOCK_SEASON_END_DATE);
  });
});

describe('nextMockAction', () => {
  it('locks whenever a gameweek is open, regardless of how many matches have finished', () => {
    expect(nextMockAction({ openGameweekExists: true, finishedCount: 5, totalMatches: 9 })).toBe('lock');
  });

  it('finishes the next match when nothing is open and matches remain', () => {
    expect(nextMockAction({ openGameweekExists: false, finishedCount: 3, totalMatches: 9 })).toBe('finish');
  });

  it('is exhausted when nothing is open and every match has finished', () => {
    expect(nextMockAction({ openGameweekExists: false, finishedCount: 9, totalMatches: 9 })).toBe('exhausted');
  });
});
