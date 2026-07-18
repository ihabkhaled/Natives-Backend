import { describe, expect, it, vi } from 'vitest';

import {
  MemberAudience,
  MembershipStatus,
  MemberViewTier,
  PlayerGender,
} from '../model/members.enums';
import type {
  MemberProfile,
  MemberRecord,
  Membership,
} from '../model/members.types';
import { MemberViewService } from './member-view.service';

const SCOPE = {} as never;
const NOW = new Date('2026-06-01T00:00:00.000Z');
const ACTOR = { userId: 'user-1', email: 'u@example.test', roles: [] };

const MEMBERSHIP: Membership = {
  id: 'mem-1',
  teamId: 'team-1',
  seasonId: null,
  userId: 'user-2',
  status: MembershipStatus.Active,
  statusReason: 'ok',
  statusEffectiveAt: NOW,
  joinedAt: NOW,
  leftAt: null,
  anonymizedAt: null,
  createdBy: 'admin-1',
  updatedBy: null,
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
  version: 1,
};

const PROFILE: MemberProfile = {
  id: 'prof-1',
  membershipId: 'mem-1',
  teamId: 'team-1',
  fullName: 'Ahmed Hassan',
  preferredName: 'Ammar',
  fullNameAr: null,
  nickname: null,
  email: 'a@example.test',
  phone: null,
  gender: PlayerGender.Man,
  division: 'open',
  positions: ['handler'],
  jerseyNumber: 7,
  jerseySize: null,
  heightCm: 180,
  weightKg: null,
  dateOfBirth: '2000-01-01',
  avatarMediaId: null,
  createdBy: 'admin-1',
  updatedBy: null,
  createdAt: NOW,
  updatedAt: NOW,
  version: 1,
};

const RECORD: MemberRecord = { membership: MEMBERSHIP, profile: PROFILE };

function build(tier: MemberViewTier, isSelf: boolean) {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const lookup = { requireRecord: vi.fn().mockResolvedValue(RECORD) };
  const access = {
    resolveAccess: vi
      .fn()
      .mockResolvedValue({ viewer: { tier, isSelf }, canManage: false }),
  };
  const service = new MemberViewService(
    unitOfWork as never,
    clock,
    lookup as never,
    access as never,
  );
  return { service, lookup, access };
}

describe('MemberViewService', () => {
  it('shapes an admin view with the raw date of birth', async () => {
    const { service } = build(MemberViewTier.Admin, false);
    const view = await service.getMember(ACTOR, 'team-1', 'mem-1');
    expect(view.audience).toBe(MemberAudience.Admin);
    expect(view.dateOfBirth).toBe('2000-01-01');
    expect(view.email).toBe('a@example.test');
  });

  it('shapes a public view redacting personal fields', async () => {
    const { service, lookup } = build(MemberViewTier.Public, false);
    const view = await service.getMember(ACTOR, 'team-1', 'mem-1');
    expect(view.audience).toBe(MemberAudience.Public);
    expect(view.email).toBeNull();
    expect(view.dateOfBirth).toBeNull();
    expect(lookup.requireRecord).toHaveBeenCalledWith(SCOPE, 'team-1', 'mem-1');
  });
});
