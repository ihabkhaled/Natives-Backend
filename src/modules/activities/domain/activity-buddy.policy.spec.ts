import { describe, expect, it } from 'vitest';

import { ActivityValidationError } from '../errors/activity-validation.error';
import { BuddyDecision, BuddyStatus } from '../model/activity.enums';
import {
  assertBuddyMemberships,
  canRespondToBuddy,
  resolveBuddyResponse,
  resolveInitialBuddyStatus,
} from './activity-buddy.policy';

describe('activity-buddy.policy', () => {
  it('accepts distinct buddy memberships', () => {
    expect(() => assertBuddyMemberships(['a', 'b'], 'self')).not.toThrow();
    expect(() => assertBuddyMemberships([], 'self')).not.toThrow();
  });

  it('rejects duplicate buddy memberships', () => {
    expect(() => assertBuddyMemberships(['a', 'a'], 'self')).toThrow(
      ActivityValidationError,
    );
  });

  it('rejects crediting the submitter as their own buddy', () => {
    expect(() => assertBuddyMemberships(['self'], 'self')).toThrow(
      ActivityValidationError,
    );
  });

  it('rejects more buddies than the bounded maximum', () => {
    const tooMany = Array.from({ length: 21 }, (_, index) => `m${index}`);
    expect(() => assertBuddyMemberships(tooMany, 'self')).toThrow(
      ActivityValidationError,
    );
  });

  it('resolves the initial buddy status from the confirmation policy', () => {
    expect(resolveInitialBuddyStatus(true)).toBe(BuddyStatus.Pending);
    expect(resolveInitialBuddyStatus(false)).toBe(BuddyStatus.Confirmed);
  });

  it('permits responding only to a pending credit', () => {
    expect(canRespondToBuddy(BuddyStatus.Pending)).toBe(true);
    expect(canRespondToBuddy(BuddyStatus.Confirmed)).toBe(false);
    expect(canRespondToBuddy(BuddyStatus.Declined)).toBe(false);
  });

  it('maps a decision to the resulting buddy status', () => {
    expect(resolveBuddyResponse(BuddyDecision.Confirm)).toBe(
      BuddyStatus.Confirmed,
    );
    expect(resolveBuddyResponse(BuddyDecision.Decline)).toBe(
      BuddyStatus.Declined,
    );
  });
});
