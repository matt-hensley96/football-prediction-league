import { describe, expect, it } from 'vitest';
import { isReminderDue } from './reminders';

describe('isReminderDue', () => {
  const deadline = new Date('2026-01-08T15:00:00Z');

  it('is not due when well before the threshold', () => {
    const now = new Date('2026-01-06T00:00:00Z');

    expect(isReminderDue(now, deadline, 24)).toBe(false);
  });

  it('is due exactly at the threshold', () => {
    const now = new Date('2026-01-07T15:00:00Z');

    expect(isReminderDue(now, deadline, 24)).toBe(true);
  });

  it('is due once past the threshold', () => {
    const now = new Date('2026-01-08T13:00:00Z');

    expect(isReminderDue(now, deadline, 3)).toBe(true);
  });

  it('is not due for the 3h rule while still more than 3h out', () => {
    const now = new Date('2026-01-08T10:00:00Z');

    expect(isReminderDue(now, deadline, 3)).toBe(false);
  });
});
