import { ValidationError } from '@core/errors/validation.error';
import { describe, expect, it, vi } from 'vitest';

import { JerseyConflictError } from '../errors/jersey-conflict.error';
import { OptimisticConflictError } from '../errors/optimistic-conflict.error';
import { ProfileForbiddenError } from '../errors/profile-forbidden.error';
import {
  MemberAudience,
  MembershipStatus,
  MemberViewTier,
  PlayerGender,
} from '../model/members.enums';
import type {
  MemberProfile,
  Membership,
  ProfileInput,
  UpdateProfileCommand,
} from '../model/members.types';
import { UpdateMemberProfileUseCase } from './update-member-profile.use-case';

const SCOPE = {} as never;
const NOW = new Date('2026-06-01T12:00:00.000Z');
const ACTOR = { userId: 'user-1', email: 'u@example.test', roles: [] };

function membership(overrides: Partial<Membership> = {}): Membership {
  return {
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
    createdBy: 'admin-1',
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    version: 1,
    ...overrides,
  };
}

const PROFILE_INPUT: ProfileInput = {
  fullName: 'Ahmed Hassan',
  preferredName: 'Ammar',
  fullNameAr: null,
  nickname: null,
  email: 'a@example.test',
  phone: null,
  gender: PlayerGender.Man,
  division: 'open',
  positions: ['handler'],
  jerseyNumber: null,
  jerseySize: null,
  heightCm: 180,
  weightKg: null,
  dateOfBirth: '2000-01-01',
};

const UPDATED_PROFILE: MemberProfile = {
  id: 'prof-1',
  membershipId: 'mem-1',
  teamId: 'team-1',
  ...PROFILE_INPUT,
  avatarMediaId: null,
  createdBy: 'admin-1',
  updatedBy: 'user-1',
  createdAt: NOW,
  updatedAt: NOW,
  version: 2,
};

function command(overrides: Partial<ProfileInput> = {}): UpdateProfileCommand {
  return { profile: { ...PROFILE_INPUT, ...overrides }, expectedVersion: 1 };
}

interface Access {
  readonly tier: MemberViewTier;
  readonly isSelf: boolean;
  readonly canManage: boolean;
}

function build(
  current: Membership,
  access: Access,
  updateResult: MemberProfile | null,
  jerseys: readonly { membershipId: string; jerseyNumber: number }[] = [],
) {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const idGenerator = { generate: vi.fn().mockReturnValue('gen') };
  const lookup = { requireMembership: vi.fn().mockResolvedValue(current) };
  const accessService = {
    resolveAccess: vi.fn().mockResolvedValue({
      viewer: { tier: access.tier, isSelf: access.isSelf },
      canManage: access.canManage,
    }),
  };
  const profiles = {
    listActiveJerseys: vi.fn().mockResolvedValue(jerseys),
    update: vi.fn().mockResolvedValue(updateResult),
  };
  const audit = { append: vi.fn() };
  const useCase = new UpdateMemberProfileUseCase(
    unitOfWork as never,
    clock,
    idGenerator,
    lookup as never,
    accessService as never,
    profiles as never,
    audit,
  );
  return { useCase, profiles, audit };
}

const SELF: Access = {
  tier: MemberViewTier.Public,
  isSelf: true,
  canManage: false,
};
const MANAGER: Access = {
  tier: MemberViewTier.Admin,
  isSelf: false,
  canManage: true,
};

describe('UpdateMemberProfileUseCase', () => {
  it('forbids a non-owner without management rights', async () => {
    const { useCase } = build(
      membership({ userId: 'other' }),
      { tier: MemberViewTier.Public, isSelf: false, canManage: false },
      UPDATED_PROFILE,
    );
    await expect(
      useCase.execute(ACTOR, 'team-1', 'mem-1', command()),
    ).rejects.toBeInstanceOf(ProfileForbiddenError);
  });

  it('forbids editing an anonymized (immutable) profile', async () => {
    const { useCase } = build(
      membership({ status: MembershipStatus.Anonymized }),
      MANAGER,
      UPDATED_PROFILE,
    );
    await expect(
      useCase.execute(ACTOR, 'team-1', 'mem-1', command()),
    ).rejects.toBeInstanceOf(ProfileForbiddenError);
  });

  it('forbids a member editing their own non-active profile', async () => {
    const { useCase } = build(
      membership({ status: MembershipStatus.Inactive }),
      SELF,
      UPDATED_PROFILE,
    );
    await expect(
      useCase.execute(ACTOR, 'team-1', 'mem-1', command()),
    ).rejects.toBeInstanceOf(ProfileForbiddenError);
  });

  it('rejects an impossible date of birth', async () => {
    const { useCase } = build(membership(), SELF, UPDATED_PROFILE);
    await expect(
      useCase.execute(
        ACTOR,
        'team-1',
        'mem-1',
        command({ dateOfBirth: '2000-13-40' }),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects a jersey number reserved by another active member', async () => {
    const { useCase } = build(membership(), MANAGER, UPDATED_PROFILE, [
      { membershipId: 'mem-2', jerseyNumber: 7 },
    ]);
    await expect(
      useCase.execute(ACTOR, 'team-1', 'mem-1', command({ jerseyNumber: 7 })),
    ).rejects.toBeInstanceOf(JerseyConflictError);
  });

  it('reports an optimistic conflict on a stale version', async () => {
    const { useCase } = build(membership(), MANAGER, null);
    await expect(
      useCase.execute(ACTOR, 'team-1', 'mem-1', command()),
    ).rejects.toBeInstanceOf(OptimisticConflictError);
  });

  it('updates and returns the shaped admin view, auditing the change', async () => {
    const { useCase, audit } = build(membership(), MANAGER, UPDATED_PROFILE);
    const view = await useCase.execute(ACTOR, 'team-1', 'mem-1', command());
    expect(view.audience).toBe(MemberAudience.Admin);
    expect(view.dateOfBirth).toBe('2000-01-01');
    expect(audit.append).toHaveBeenCalledOnce();
  });

  it('skips the jersey scan when no number is set', async () => {
    const { useCase, profiles } = build(membership(), SELF, UPDATED_PROFILE);
    await useCase.execute(ACTOR, 'team-1', 'mem-1', command());
    expect(profiles.listActiveJerseys).not.toHaveBeenCalled();
  });
});
