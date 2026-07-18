import { describe, expect, it } from 'vitest';

import { SessionStatus } from '../model/practices.enums';
import { canMemberRespond, isRsvpWindowOpen } from './rsvp-deadline.policy';

const NOW = new Date('2026-06-01T12:00:00.000Z');

describe('isRsvpWindowOpen', () => {
  it('is always open when there is no cutoff', () => {
    expect(isRsvpWindowOpen(NOW, null)).toBe(true);
  });

  it('is open strictly before the cutoff', () => {
    expect(isRsvpWindowOpen(NOW, new Date('2026-06-01T12:00:01.000Z'))).toBe(
      true,
    );
  });

  it('is open exactly at the cutoff instant (inclusive boundary)', () => {
    expect(isRsvpWindowOpen(NOW, new Date('2026-06-01T12:00:00.000Z'))).toBe(
      true,
    );
  });

  it('is closed after the cutoff', () => {
    expect(isRsvpWindowOpen(NOW, new Date('2026-06-01T11:59:59.000Z'))).toBe(
      false,
    );
  });
});

describe('canMemberRespond', () => {
  it('accepts published and rescheduled sessions', () => {
    expect(canMemberRespond(SessionStatus.Published)).toBe(true);
    expect(canMemberRespond(SessionStatus.Rescheduled)).toBe(true);
  });

  it('rejects every closed or not-yet-announced state', () => {
    expect(canMemberRespond(SessionStatus.Draft)).toBe(false);
    expect(canMemberRespond(SessionStatus.Cancelled)).toBe(false);
    expect(canMemberRespond(SessionStatus.Completed)).toBe(false);
    expect(canMemberRespond(SessionStatus.Archived)).toBe(false);
  });
});
