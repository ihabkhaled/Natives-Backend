import { describe, expect, it } from 'vitest';

import { InvitationStatus } from '../model/identity.enums';
import type { Invitation } from '../model/identity.types';
import {
  isInvitationAcceptable,
  isInvitationExpired,
  isInvitationMutable,
} from './invitation.policy';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const FUTURE = new Date(NOW.getTime() + 60_000);
const PAST = new Date(NOW.getTime() - 60_000);

function makeInvitation(overrides: Partial<Invitation> = {}): Invitation {
  return {
    id: 'inv-1',
    email: 'invitee@example.test',
    invitedBy: 'admin-1',
    role: 'user' as Invitation['role'],
    teamId: null,
    status: InvitationStatus.Pending,
    expiresAt: FUTURE,
    acceptedAt: null,
    revokedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('isInvitationAcceptable', () => {
  it('accepts a pending, unexpired, un-accepted, un-revoked invitation', () => {
    expect(isInvitationAcceptable(makeInvitation(), NOW)).toBe(true);
  });

  it('rejects a non-pending status', () => {
    expect(
      isInvitationAcceptable(
        makeInvitation({ status: InvitationStatus.Accepted }),
        NOW,
      ),
    ).toBe(false);
  });

  it('rejects an already-accepted invitation', () => {
    expect(
      isInvitationAcceptable(makeInvitation({ acceptedAt: PAST }), NOW),
    ).toBe(false);
  });

  it('rejects a revoked invitation', () => {
    expect(
      isInvitationAcceptable(makeInvitation({ revokedAt: PAST }), NOW),
    ).toBe(false);
  });

  it('rejects an expired invitation (expiry in the past)', () => {
    expect(
      isInvitationAcceptable(makeInvitation({ expiresAt: PAST }), NOW),
    ).toBe(false);
  });

  it('rejects an invitation expiring exactly now (boundary)', () => {
    expect(
      isInvitationAcceptable(makeInvitation({ expiresAt: NOW }), NOW),
    ).toBe(false);
  });
});

describe('isInvitationExpired', () => {
  it('reports a pending invitation past expiry as expired', () => {
    expect(isInvitationExpired(makeInvitation({ expiresAt: PAST }), NOW)).toBe(
      true,
    );
  });

  it('reports a pending invitation expiring exactly now as expired (boundary)', () => {
    expect(isInvitationExpired(makeInvitation({ expiresAt: NOW }), NOW)).toBe(
      true,
    );
  });

  it('does not report an unexpired pending invitation as expired', () => {
    expect(
      isInvitationExpired(makeInvitation({ expiresAt: FUTURE }), NOW),
    ).toBe(false);
  });

  it('does not report a non-pending invitation as expired even when past', () => {
    expect(
      isInvitationExpired(
        makeInvitation({ status: InvitationStatus.Revoked, expiresAt: PAST }),
        NOW,
      ),
    ).toBe(false);
  });
});

describe('isInvitationMutable', () => {
  it('is mutable while pending', () => {
    expect(isInvitationMutable(makeInvitation())).toBe(true);
  });

  it.each([
    InvitationStatus.Accepted,
    InvitationStatus.Revoked,
    InvitationStatus.Expired,
  ])('is not mutable when %s', status => {
    expect(isInvitationMutable(makeInvitation({ status }))).toBe(false);
  });
});
