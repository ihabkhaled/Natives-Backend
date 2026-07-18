import { describe, expect, it } from 'vitest';

import { ReminderKind } from '../model/calendar.enums';
import type { ReminderPolicyInput } from '../model/calendar.types';
import { resolveReminderKinds } from './practice-reminder.policy';

const NOW = new Date('2026-07-18T10:00:00.000Z');

function input(
  overrides: Partial<ReminderPolicyInput> = {},
): ReminderPolicyInput {
  return {
    now: NOW,
    startsAt: new Date('2026-07-19T09:00:00.000Z'),
    rsvpCutoffAt: new Date('2026-07-18T11:00:00.000Z'),
    hasResponded: false,
    ...overrides,
  };
}

describe('practice reminder policy', () => {
  it('selects upcoming, no-response, and cutoff reminders when all are due', () => {
    expect(resolveReminderKinds(input())).toEqual([
      ReminderKind.Upcoming,
      ReminderKind.NoResponse,
      ReminderKind.Cutoff,
    ]);
  });

  it('does not select no-response or cutoff after a member responded', () => {
    expect(resolveReminderKinds(input({ hasResponded: true }))).toEqual([
      ReminderKind.Upcoming,
    ]);
  });

  it('does not select reminders for a practice outside the upcoming window', () => {
    expect(
      resolveReminderKinds(
        input({
          startsAt: new Date('2026-07-20T12:00:00.000Z'),
          rsvpCutoffAt: new Date('2026-07-20T10:00:00.000Z'),
        }),
      ),
    ).toEqual([]);
  });

  it('does not select reminders for a practice that already started', () => {
    expect(
      resolveReminderKinds(
        input({ startsAt: new Date('2026-07-18T09:00:00.000Z') }),
      ),
    ).toEqual([]);
  });

  it('does not select cutoff reminders when there is no cutoff', () => {
    expect(resolveReminderKinds(input({ rsvpCutoffAt: null }))).toEqual([
      ReminderKind.Upcoming,
    ]);
  });
});
