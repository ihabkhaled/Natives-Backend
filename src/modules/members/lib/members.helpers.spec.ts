import { describe, expect, it } from 'vitest';

import {
  AliasSource,
  MediaPurpose,
  MediaScanStatus,
  MembershipStatus,
  PlayerGender,
} from '../model/members.enums';
import type {
  AliasRow,
  MediaAssetRow,
  MemberProfileRow,
  MembershipRow,
  StatusEventRow,
} from '../model/members.rows';
import {
  isIsoCalendarDate,
  parseNullableGender,
  resolvePage,
  toAlias,
  toDate,
  toMediaAsset,
  toMemberProfile,
  toMembership,
  toNullableDate,
  toNullableNumber,
  toStatusEvent,
} from './members.helpers';

const ISO = '2026-01-01T00:00:00.000Z';

const MEMBERSHIP_ROW: MembershipRow = {
  id: 'mem-1',
  team_id: 'team-1',
  season_id: null,
  user_id: 'user-1',
  status: 'active',
  status_reason: 'ok',
  status_effective_at: ISO,
  joined_at: ISO,
  left_at: null,
  anonymized_at: null,
  created_by: 'admin-1',
  updated_by: null,
  created_at: ISO,
  updated_at: ISO,
  deleted_at: null,
  version: 2,
};

const PROFILE_ROW: MemberProfileRow = {
  id: 'prof-1',
  membership_id: 'mem-1',
  team_id: 'team-1',
  full_name: 'Ahmed Hassan',
  preferred_name: null,
  full_name_ar: null,
  nickname: null,
  email: null,
  phone: null,
  gender: 'man',
  division: null,
  positions: ['handler'],
  jersey_number: 7,
  jersey_size: null,
  height_cm: '180.0',
  weight_kg: null,
  date_of_birth: '2000-01-01',
  avatar_media_id: null,
  created_by: 'admin-1',
  updated_by: null,
  created_at: ISO,
  updated_at: ISO,
  version: 1,
};

describe('members.helpers', () => {
  describe('scalar conversions', () => {
    it('converts strings and Date instances', () => {
      expect(toDate(ISO)).toEqual(new Date(ISO));
      const date = new Date(ISO);
      expect(toDate(date)).toBe(date);
    });

    it('preserves null for nullable dates', () => {
      expect(toNullableDate(null)).toBeNull();
      expect(toNullableDate(ISO)).toEqual(new Date(ISO));
      const date = new Date(ISO);
      expect(toNullableDate(date)).toBe(date);
    });

    it('preserves null for nullable numbers (null-not-zero)', () => {
      expect(toNullableNumber(null)).toBeNull();
      expect(toNullableNumber('75.5')).toBe(75.5);
    });
  });

  describe('isIsoCalendarDate', () => {
    it('accepts a real calendar date', () => {
      expect(isIsoCalendarDate('2005-06-30')).toBe(true);
    });

    it('rejects malformed and impossible dates', () => {
      expect(isIsoCalendarDate('2005-6-3')).toBe(false);
      expect(isIsoCalendarDate('2005-02-30')).toBe(false);
      expect(isIsoCalendarDate('not-a-date')).toBe(false);
    });
  });

  describe('resolvePage', () => {
    it('applies defaults', () => {
      expect(resolvePage(undefined, undefined)).toEqual({
        limit: 20,
        offset: 0,
      });
    });

    it('caps the limit and floors negatives', () => {
      expect(resolvePage(9999, -5)).toEqual({ limit: 100, offset: 0 });
      expect(resolvePage(0, 10)).toEqual({ limit: 1, offset: 10 });
    });
  });

  describe('parseNullableGender', () => {
    it('parses null and known values', () => {
      expect(parseNullableGender(null)).toBeNull();
      expect(parseNullableGender('woman')).toBe(PlayerGender.Woman);
    });

    it('throws on an unknown value', () => {
      expect(() => parseNullableGender('alien')).toThrow();
    });
  });

  describe('row mappers', () => {
    it('maps a membership row', () => {
      const membership = toMembership(MEMBERSHIP_ROW);
      expect(membership.status).toBe(MembershipStatus.Active);
      expect(membership.seasonId).toBeNull();
      expect(membership.joinedAt).toEqual(new Date(ISO));
      expect(membership.version).toBe(2);
    });

    it('maps a profile row, preserving null measurements', () => {
      const profile = toMemberProfile(PROFILE_ROW);
      expect(profile.gender).toBe(PlayerGender.Man);
      expect(profile.heightCm).toBe(180);
      expect(profile.weightKg).toBeNull();
      expect(profile.positions).toEqual(['handler']);
      expect(profile.dateOfBirth).toBe('2000-01-01');
    });

    it('maps a status event row with a null from-status', () => {
      const row: StatusEventRow = {
        id: 'ev-1',
        membership_id: 'mem-1',
        from_status: null,
        to_status: 'invited',
        reason: null,
        actor_user_id: 'admin-1',
        effective_at: ISO,
        occurred_at: ISO,
      };
      const event = toStatusEvent(row);
      expect(event.fromStatus).toBeNull();
      expect(event.toStatus).toBe(MembershipStatus.Invited);
    });

    it('maps a status event row with a from-status', () => {
      const row: StatusEventRow = {
        id: 'ev-2',
        membership_id: 'mem-1',
        from_status: 'invited',
        to_status: 'active',
        reason: 'accepted',
        actor_user_id: 'admin-1',
        effective_at: ISO,
        occurred_at: ISO,
      };
      expect(toStatusEvent(row).fromStatus).toBe(MembershipStatus.Invited);
    });

    it('maps an alias row', () => {
      const row: AliasRow = {
        id: 'al-1',
        membership_id: 'mem-1',
        team_id: 'team-1',
        alias: 'Speedy',
        normalized_alias: 'speedy',
        source: 'import',
        created_by: 'admin-1',
        created_at: ISO,
        deleted_at: null,
      };
      const alias = toAlias(row);
      expect(alias.source).toBe(AliasSource.Import);
      expect(alias.normalizedAlias).toBe('speedy');
    });

    it('maps a media asset row', () => {
      const row: MediaAssetRow = {
        id: 'md-1',
        team_id: 'team-1',
        membership_id: 'mem-1',
        purpose: 'avatar',
        storage_key: 'teams/team-1/mem-1/md-1',
        content_type: 'image/png',
        byte_size: '2048',
        width: 256,
        height: 256,
        scan_status: 'clean',
        created_by: 'admin-1',
        created_at: ISO,
        deleted_at: null,
      };
      const asset = toMediaAsset(row);
      expect(asset.purpose).toBe(MediaPurpose.Avatar);
      expect(asset.scanStatus).toBe(MediaScanStatus.Clean);
      expect(asset.byteSize).toBe(2048);
    });
  });
});
