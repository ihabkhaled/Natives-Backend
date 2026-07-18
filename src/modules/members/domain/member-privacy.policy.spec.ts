import { describe, expect, it } from 'vitest';

import {
  AgeClassification,
  MemberAudience,
  MembershipStatus,
  MemberViewTier,
  PlayerGender,
} from '../model/members.enums';
import type {
  MemberProfile,
  MemberRecord,
  Membership,
  ViewerContext,
} from '../model/members.types';
import { resolveAudienceLabel, shapeMemberView } from './member-privacy.policy';

const NOW = new Date('2026-06-01T00:00:00.000Z');

const MEMBERSHIP: Membership = {
  id: 'mem-1',
  teamId: 'team-1',
  seasonId: null,
  userId: 'user-1',
  status: MembershipStatus.Active,
  statusReason: 'Approved by coach',
  statusEffectiveAt: NOW,
  joinedAt: NOW,
  leftAt: null,
  anonymizedAt: null,
  createdBy: 'admin-1',
  updatedBy: 'admin-1',
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
  fullNameAr: 'أحمد حسن',
  nickname: 'Speedy',
  email: 'ahmed@example.test',
  phone: '+200000000',
  gender: PlayerGender.Man,
  division: 'open',
  positions: ['handler'],
  jerseyNumber: 7,
  jerseySize: 'L',
  heightCm: 180,
  weightKg: 75,
  dateOfBirth: '2000-01-01',
  avatarMediaId: 'media-1',
  createdBy: 'admin-1',
  updatedBy: 'admin-1',
  createdAt: NOW,
  updatedAt: NOW,
  version: 3,
};

const RECORD: MemberRecord = { membership: MEMBERSHIP, profile: PROFILE };
const AGE = AgeClassification.Senior;

function shape(viewer: ViewerContext) {
  return shapeMemberView(RECORD, viewer, AGE);
}

describe('member-privacy.policy', () => {
  describe('resolveAudienceLabel', () => {
    it('labels each distinct audience', () => {
      expect(
        resolveAudienceLabel({ tier: MemberViewTier.Admin, isSelf: false }),
      ).toBe(MemberAudience.Admin);
      expect(
        resolveAudienceLabel({ tier: MemberViewTier.Coach, isSelf: false }),
      ).toBe(MemberAudience.Coach);
      expect(
        resolveAudienceLabel({ tier: MemberViewTier.Public, isSelf: true }),
      ).toBe(MemberAudience.Self);
      expect(
        resolveAudienceLabel({ tier: MemberViewTier.Teammate, isSelf: false }),
      ).toBe(MemberAudience.Teammate);
      expect(
        resolveAudienceLabel({ tier: MemberViewTier.Public, isSelf: false }),
      ).toBe(MemberAudience.Public);
    });
  });

  describe('public view', () => {
    const view = shape({ tier: MemberViewTier.Public, isSelf: false });

    it('exposes only public fields', () => {
      expect(view.audience).toBe(MemberAudience.Public);
      expect(view.displayName).toBe('Ammar');
      expect(view.jerseyNumber).toBe(7);
      expect(view.positions).toEqual(['handler']);
      expect(view.hasAvatar).toBe(true);
    });

    it('redacts teammate, personal, and admin fields', () => {
      expect(view.gender).toBeNull();
      expect(view.fullNameAr).toBeNull();
      expect(view.fullName).toBeNull();
      expect(view.email).toBeNull();
      expect(view.phone).toBeNull();
      expect(view.heightCm).toBeNull();
      expect(view.ageClassification).toBeNull();
      expect(view.dateOfBirth).toBeNull();
      expect(view.statusReason).toBeNull();
      expect(view.version).toBeNull();
    });
  });

  describe('teammate view', () => {
    const view = shape({ tier: MemberViewTier.Teammate, isSelf: false });

    it('adds teammate fields but not personal ones', () => {
      expect(view.audience).toBe(MemberAudience.Teammate);
      expect(view.gender).toBe(PlayerGender.Man);
      expect(view.fullNameAr).toBe('أحمد حسن');
      expect(view.preferredName).toBe('Ammar');
      expect(view.email).toBeNull();
      expect(view.dateOfBirth).toBeNull();
    });
  });

  describe('self view', () => {
    const view = shape({ tier: MemberViewTier.Public, isSelf: true });

    it('exposes own personal fields and own date of birth', () => {
      expect(view.audience).toBe(MemberAudience.Self);
      expect(view.email).toBe('ahmed@example.test');
      expect(view.phone).toBe('+200000000');
      expect(view.heightCm).toBe(180);
      expect(view.ageClassification).toBe(AgeClassification.Senior);
      expect(view.dateOfBirth).toBe('2000-01-01');
    });

    it('does not expose admin audit fields', () => {
      expect(view.statusReason).toBeNull();
      expect(view.createdBy).toBeNull();
      expect(view.version).toBeNull();
    });
  });

  describe('coach view', () => {
    const view = shape({ tier: MemberViewTier.Coach, isSelf: false });

    it('exposes personal fields but not raw date of birth', () => {
      expect(view.audience).toBe(MemberAudience.Coach);
      expect(view.email).toBe('ahmed@example.test');
      expect(view.heightCm).toBe(180);
      expect(view.ageClassification).toBe(AgeClassification.Senior);
      expect(view.dateOfBirth).toBeNull();
      expect(view.statusReason).toBeNull();
    });
  });

  describe('admin view', () => {
    const view = shape({ tier: MemberViewTier.Admin, isSelf: false });

    it('exposes every field including audit and raw date of birth', () => {
      expect(view.audience).toBe(MemberAudience.Admin);
      expect(view.dateOfBirth).toBe('2000-01-01');
      expect(view.statusReason).toBe('Approved by coach');
      expect(view.createdBy).toBe('admin-1');
      expect(view.updatedBy).toBe('admin-1');
      expect(view.version).toBe(3);
    });
  });

  describe('display name fallback', () => {
    it('falls back to full name when no preferred name is set', () => {
      const record: MemberRecord = {
        membership: MEMBERSHIP,
        profile: { ...PROFILE, preferredName: null },
      };
      const view = shapeMemberView(
        record,
        { tier: MemberViewTier.Public, isSelf: false },
        null,
      );
      expect(view.displayName).toBe('Ahmed Hassan');
    });
  });
});
