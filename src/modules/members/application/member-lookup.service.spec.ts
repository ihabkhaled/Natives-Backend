import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MembershipNotFoundError } from '../errors/membership-not-found.error';
import { MembershipStatus } from '../model/members.enums';
import type { MemberProfile, Membership } from '../model/members.types';
import { MemberLookupService } from './member-lookup.service';

const SCOPE = {} as never;
const NOW = new Date('2026-06-01T00:00:00.000Z');

const MEMBERSHIP: Membership = {
  id: 'mem-1',
  teamId: 'team-1',
  seasonId: null,
  userId: 'user-1',
  status: MembershipStatus.Active,
  statusReason: null,
  statusEffectiveAt: NOW,
  joinedAt: NOW,
  leftAt: null,
  anonymizedAt: null,
  createdBy: null,
  updatedBy: null,
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
  version: 1,
};

const PROFILE = { membershipId: 'mem-1' } as MemberProfile;

function build() {
  const memberships = { findById: vi.fn() };
  const profiles = { findByMembershipId: vi.fn() };
  const service = new MemberLookupService(
    memberships as never,
    profiles as never,
  );
  return { service, memberships, profiles };
}

describe('MemberLookupService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('requires an existing membership', async () => {
    harness.memberships.findById.mockResolvedValue(MEMBERSHIP);
    await expect(
      harness.service.requireMembership(SCOPE, 'team-1', 'mem-1'),
    ).resolves.toBe(MEMBERSHIP);
  });

  it('throws when the membership is missing', async () => {
    harness.memberships.findById.mockResolvedValue(null);
    await expect(
      harness.service.requireMembership(SCOPE, 'team-1', 'missing'),
    ).rejects.toBeInstanceOf(MembershipNotFoundError);
  });

  it('requires a full record', async () => {
    harness.memberships.findById.mockResolvedValue(MEMBERSHIP);
    harness.profiles.findByMembershipId.mockResolvedValue(PROFILE);
    await expect(
      harness.service.requireRecord(SCOPE, 'team-1', 'mem-1'),
    ).resolves.toEqual({ membership: MEMBERSHIP, profile: PROFILE });
  });

  it('throws when the profile is missing', async () => {
    harness.memberships.findById.mockResolvedValue(MEMBERSHIP);
    harness.profiles.findByMembershipId.mockResolvedValue(null);
    await expect(
      harness.service.requireRecord(SCOPE, 'team-1', 'mem-1'),
    ).rejects.toBeInstanceOf(MembershipNotFoundError);
  });
});
