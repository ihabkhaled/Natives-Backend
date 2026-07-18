import { Permission } from '@shared/enums';
import { describe, expect, it, vi } from 'vitest';

import { MembershipStatus, MemberViewTier } from '../model/members.enums';
import type { Membership } from '../model/members.types';
import { MemberAccessService } from './member-access.service';

const SCOPE = {} as never;
const NOW = new Date('2026-06-01T00:00:00.000Z');
const ACTOR = { userId: 'user-1', email: 'u@example.test', roles: [] };

function membership(userId: string | null): Membership {
  return {
    id: 'mem-1',
    teamId: 'team-1',
    seasonId: null,
    userId,
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
}

function build(permissions: string[], activeTeamMember: boolean) {
  const resolver = { resolve: vi.fn().mockResolvedValue(new Set(permissions)) };
  const memberships = {
    findActiveByUser: vi.fn().mockResolvedValue(activeTeamMember ? {} : null),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const service = new MemberAccessService(
    resolver,
    unitOfWork as never,
    memberships as never,
  );
  return { service, resolver, memberships };
}

describe('MemberAccessService', () => {
  it('resolves an admin tier and management from perms', async () => {
    const { service } = build(
      [Permission.MemberProfileReadAdmin, Permission.MemberLifecycleManage],
      false,
    );
    const access = await service.resolveAccess(
      ACTOR,
      'team-1',
      membership('other'),
    );
    expect(access.viewer.tier).toBe(MemberViewTier.Admin);
    expect(access.canManage).toBe(true);
    expect(access.viewer.isSelf).toBe(false);
  });

  it('resolves a coach tier', async () => {
    const { service } = build([Permission.MemberProfileReadCoach], false);
    const access = await service.resolveAccess(
      ACTOR,
      'team-1',
      membership('user-1'),
    );
    expect(access.viewer.tier).toBe(MemberViewTier.Coach);
    expect(access.viewer.isSelf).toBe(true);
    expect(access.canManage).toBe(false);
  });

  it('resolves a teammate tier for an active team member', async () => {
    const { service } = build([Permission.MemberProfileReadPublic], true);
    const access = await service.resolveAccess(
      ACTOR,
      'team-1',
      membership('other'),
    );
    expect(access.viewer.tier).toBe(MemberViewTier.Teammate);
  });

  it('falls back to a public tier for a non-member with only public read', async () => {
    const { service } = build([Permission.MemberProfileReadPublic], false);
    const access = await service.resolveAccess(
      ACTOR,
      'team-1',
      membership('other'),
    );
    expect(access.viewer.tier).toBe(MemberViewTier.Public);
  });

  it('is not self when the membership has no linked account', async () => {
    const { service } = build([], false);
    const access = await service.resolveAccess(
      ACTOR,
      'team-1',
      membership(null),
    );
    expect(access.viewer.isSelf).toBe(false);
  });
});
