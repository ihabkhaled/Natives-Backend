import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PlayerGender } from '../model/members.enums';
import type { JerseyRow, MemberProfileRow } from '../model/members.rows';
import type {
  MemberProfileUpdate,
  NewMemberProfile,
  ProfileInput,
  ProfileRedaction,
} from '../model/members.types';
import { MemberProfileRepository } from './member-profile.repository';

const NOW = new Date('2026-06-01T12:00:00.000Z');

function buildScope() {
  return { run: vi.fn() };
}

function profileRow(
  overrides: Partial<MemberProfileRow> = {},
): MemberProfileRow {
  return {
    id: 'prof-1',
    membership_id: 'mem-1',
    team_id: 'team-1',
    full_name: 'Ahmed Hassan',
    preferred_name: null,
    full_name_ar: null,
    nickname: null,
    email: null,
    phone: null,
    gender: null,
    division: null,
    positions: [],
    jersey_number: null,
    jersey_size: null,
    height_cm: null,
    weight_kg: null,
    date_of_birth: null,
    avatar_media_id: null,
    created_by: 'admin-1',
    updated_by: null,
    created_at: '2026-06-01T12:00:00.000Z',
    updated_at: '2026-06-01T12:00:00.000Z',
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
  jerseyNumber: 7,
  jerseySize: 'L',
  heightCm: 180,
  weightKg: null,
  dateOfBirth: '2000-01-01',
};

const NEW_PROFILE: NewMemberProfile = {
  id: 'prof-1',
  membershipId: 'mem-1',
  teamId: 'team-1',
  profile: PROFILE_INPUT,
  createdBy: 'admin-1',
  now: NOW,
};

const PROFILE_UPDATE: MemberProfileUpdate = {
  membershipId: 'mem-1',
  profile: PROFILE_INPUT,
  updatedBy: 'user-1',
  expectedVersion: 1,
  now: NOW,
};

const REDACTION: ProfileRedaction = {
  membershipId: 'mem-1',
  redactedName: 'Former member',
  updatedBy: 'admin-1',
  now: NOW,
};

describe('MemberProfileRepository', () => {
  let repo: MemberProfileRepository;
  let scope: ReturnType<typeof buildScope>;

  beforeEach(() => {
    repo = new MemberProfileRepository();
    scope = buildScope();
  });

  it('finds a profile by membership id or returns null', async () => {
    scope.run.mockResolvedValueOnce([profileRow({ jersey_number: 7 })]);
    await expect(
      repo.findByMembershipId(scope as never, 'mem-1'),
    ).resolves.toMatchObject({ jerseyNumber: 7 });

    scope.run.mockResolvedValueOnce([]);
    await expect(
      repo.findByMembershipId(scope as never, 'missing'),
    ).resolves.toBeNull();
  });

  it('inserts a profile and binds positions', async () => {
    scope.run.mockResolvedValue([profileRow()]);
    await repo.insert(scope as never, NEW_PROFILE);
    expect(scope.run.mock.calls[0]?.[1]?.[11]).toEqual(['handler']);
  });

  it('throws when the insert returns no row', async () => {
    scope.run.mockResolvedValue([]);
    await expect(repo.insert(scope as never, NEW_PROFILE)).rejects.toThrow(
      /returned row/u,
    );
  });

  it('updates a profile or returns null on version mismatch', async () => {
    scope.run.mockResolvedValueOnce([profileRow({ version: 2 })]);
    await expect(
      repo.update(scope as never, PROFILE_UPDATE),
    ).resolves.toMatchObject({ version: 2 });

    scope.run.mockResolvedValueOnce([]);
    await expect(
      repo.update(scope as never, PROFILE_UPDATE),
    ).resolves.toBeNull();
  });

  it('updates the avatar or returns null when missing', async () => {
    scope.run.mockResolvedValueOnce([profileRow({ avatar_media_id: 'md-1' })]);
    await expect(
      repo.updateAvatar(scope as never, 'mem-1', 'md-1', 'user-1', NOW),
    ).resolves.toMatchObject({ avatarMediaId: 'md-1' });

    scope.run.mockResolvedValueOnce([]);
    await expect(
      repo.updateAvatar(scope as never, 'missing', 'md-1', null, NOW),
    ).resolves.toBeNull();
  });

  it('redacts a profile', async () => {
    scope.run.mockResolvedValueOnce([]);
    await repo.redact(scope as never, REDACTION);
    expect(scope.run.mock.calls[0]?.[1]?.[1]).toBe('Former member');
  });

  it('lists active jerseys', async () => {
    const rows: JerseyRow[] = [
      { membership_id: 'mem-1', jersey_number: 7 },
      { membership_id: 'mem-2', jersey_number: 8 },
    ];
    scope.run.mockResolvedValueOnce(rows);
    await expect(
      repo.listActiveJerseys(scope as never, 'team-1', null, 1000),
    ).resolves.toEqual([
      { membershipId: 'mem-1', jerseyNumber: 7 },
      { membershipId: 'mem-2', jerseyNumber: 8 },
    ]);
  });
});
