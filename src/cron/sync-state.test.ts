import { describe, expect, it } from 'vitest';
import { isSyncStale } from './sync-state';

describe('isSyncStale', () => {
  const now = new Date('2026-09-01T12:00:00Z');

  it('is stale when there has never been a sync', () => {
    expect(isSyncStale(null, now)).toBe(true);
  });

  it('is not stale when the last sync was under 15 minutes ago', () => {
    expect(isSyncStale('2026-09-01 11:50:00', now)).toBe(false);
  });

  it('is stale once the last sync is 15 minutes old', () => {
    expect(isSyncStale('2026-09-01 11:45:00', now)).toBe(true);
  });

  it('is stale when the last sync was hours ago', () => {
    expect(isSyncStale('2026-09-01 06:00:00', now)).toBe(true);
  });

  it('treats an unparseable timestamp as stale', () => {
    expect(isSyncStale('not a date', now)).toBe(true);
  });
});
