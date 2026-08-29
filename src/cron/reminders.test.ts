import { describe, expect, it } from 'vitest';
import { isReminderDue } from './reminders';

describe('isReminderDue', () => {
  const deadline = new Date('2026-01-08T15:00:00Z');

  it('is not due when well before the threshold', () => {
    const now = new Date('2026-01-06T00:00:00Z');

    expect(isReminderDue(now, deadline, 36)).toBe(false);
  });

  it('is due exactly at the threshold', () => {
    const now = new Date('2026-01-07T03:00:00Z');

    expect(isReminderDue(now, deadline, 36)).toBe(true);
  });

  it('is due once past the threshold', () => {
    const now = new Date('2026-01-08T13:00:00Z');

    expect(isReminderDue(now, deadline, 36)).toBe(true);
  });
});
