import { describe, expect, it, vi } from 'vitest';

import { MediaNotFoundError } from '../errors/media-not-found.error';
import { MediaNotScannedError } from '../errors/media-not-scanned.error';
import { MembershipNotFoundError } from '../errors/membership-not-found.error';
import { ProfileForbiddenError } from '../errors/profile-forbidden.error';
import {
  MediaPurpose,
  MediaScanStatus,
  MemberAudience,
  MembershipStatus,
  MemberViewTier,
} from '../model/members.enums';
import type {
  MediaAsset,
  MemberProfile,
  Membership,
} from '../model/members.types';
import { SetMemberAvatarUseCase } from './set-member-avatar.use-case';

const SCOPE = {} as never;
const NOW = new Date('2026-06-01T12:00:00.000Z');
const ACTOR = { userId: 'user-1', email: 'u@example.test', roles: [] };

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
  email: null,
  phone: null,
  gender: null,
  division: null,
  positions: [],
  jerseyNumber: null,
  jerseySize: null,
  heightCm: null,
  weightKg: null,
  dateOfBirth: null,
  avatarMediaId: 'md-1',
  createdBy: 'admin-1',
  updatedBy: 'user-1',
  createdAt: NOW,
  updatedAt: NOW,
  version: 2,
};

function asset(scanStatus: MediaScanStatus): MediaAsset {
  return {
    id: 'md-1',
    teamId: 'team-1',
    membershipId: 'mem-1',
    purpose: MediaPurpose.Avatar,
    storageKey: 'members/team-1/mem-1/md-1',
    contentType: 'image/png',
    byteSize: 2048,
    width: 256,
    height: 256,
    scanStatus,
    createdBy: 'admin-1',
    createdAt: NOW,
    deletedAt: null,
  };
}

function build(
  canManage: boolean,
  isSelf: boolean,
  found: MediaAsset | null,
  updated: MemberProfile | null,
) {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const idGenerator = { generate: vi.fn().mockReturnValue('gen') };
  const lookup = { requireMembership: vi.fn().mockResolvedValue(MEMBERSHIP) };
  const access = {
    resolveAccess: vi.fn().mockResolvedValue({
      viewer: { tier: MemberViewTier.Admin, isSelf },
      canManage,
    }),
  };
  const profiles = { updateAvatar: vi.fn().mockResolvedValue(updated) };
  const media = { findById: vi.fn().mockResolvedValue(found) };
  const audit = { append: vi.fn() };
  const useCase = new SetMemberAvatarUseCase(
    unitOfWork as never,
    clock,
    idGenerator,
    lookup as never,
    access as never,
    profiles as never,
    media as never,
    audit,
  );
  return { useCase, profiles, audit };
}

describe('SetMemberAvatarUseCase', () => {
  it('forbids a non-owner without management rights', async () => {
    const { useCase } = build(
      false,
      false,
      asset(MediaScanStatus.Clean),
      PROFILE,
    );
    await expect(
      useCase.execute(ACTOR, 'team-1', 'mem-1', 'md-1'),
    ).rejects.toBeInstanceOf(ProfileForbiddenError);
  });

  it('throws when the media asset does not exist', async () => {
    const { useCase } = build(true, false, null, PROFILE);
    await expect(
      useCase.execute(ACTOR, 'team-1', 'mem-1', 'md-1'),
    ).rejects.toBeInstanceOf(MediaNotFoundError);
  });

  it('rejects an asset that has not cleared the scan', async () => {
    const { useCase } = build(
      true,
      false,
      asset(MediaScanStatus.Pending),
      PROFILE,
    );
    await expect(
      useCase.execute(ACTOR, 'team-1', 'mem-1', 'md-1'),
    ).rejects.toBeInstanceOf(MediaNotScannedError);
  });

  it('throws when the profile row is missing', async () => {
    const { useCase } = build(true, false, asset(MediaScanStatus.Clean), null);
    await expect(
      useCase.execute(ACTOR, 'team-1', 'mem-1', 'md-1'),
    ).rejects.toBeInstanceOf(MembershipNotFoundError);
  });

  it('attaches a clean avatar and returns the shaped view', async () => {
    const { useCase, profiles, audit } = build(
      true,
      false,
      asset(MediaScanStatus.Clean),
      PROFILE,
    );
    const view = await useCase.execute(ACTOR, 'team-1', 'mem-1', 'md-1');
    expect(view.audience).toBe(MemberAudience.Admin);
    expect(view.hasAvatar).toBe(true);
    expect(profiles.updateAvatar).toHaveBeenCalledWith(
      SCOPE,
      'mem-1',
      'md-1',
      'user-1',
      NOW,
    );
    expect(audit.append).toHaveBeenCalledOnce();
  });
});
