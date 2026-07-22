import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MembershipStatus } from '../model/members.enums';
import type { DirectoryRow, MembershipRow } from '../model/members.rows';
import type {
  MembershipStatusChange,
  NewMembership,
} from '../model/members.types';
import { MembershipRepository } from './membership.repository';

const NOW = new Date('2026-06-01T12:00:00.000Z');

function buildScope() {
  return { run: vi.fn() };
}

function membershipRow(overrides: Partial<MembershipRow> = {}): MembershipRow {
  return {
    id: 'mem-1',
    team_id: 'team-1',
    season_id: null,
    user_id: 'user-1',
    status: 'active',
    status_reason: null,
    status_effective_at: '2026-06-01T12:00:00.000Z',
    joined_at: '2026-06-01T12:00:00.000Z',
    left_at: null,
    anonymized_at: null,
    created_by: 'admin-1',
    updated_by: null,
    created_at: '2026-06-01T12:00:00.000Z',
    updated_at: '2026-06-01T12:00:00.000Z',
    deleted_at: null,
    version: 1,
    ...overrides,
  };
}

function directoryRow(overrides: Partial<DirectoryRow> = {}): DirectoryRow {
  return {
    membership_id: 'mem-1',
    team_id: 'team-1',
    status: 'active',
    display_name: 'Ahmed',
    nickname: null,
    jersey_number: 7,
    positions: ['handler'],
    has_avatar: true,
    ...overrides,
  };
}

const NEW_ACTIVE: NewMembership = {
  id: 'mem-1',
  teamId: 'team-1',
  seasonId: null,
  userId: 'user-1',
  status: MembershipStatus.Active,
  statusEffectiveAt: NOW,
  createdBy: 'admin-1',
  now: NOW,
};

const CHANGE: MembershipStatusChange = {
  id: 'mem-1',
  toStatus: MembershipStatus.Left,
  reason: 'moved',
  statusEffectiveAt: NOW,
  joinedAt: NOW,
  leftAt: NOW,
  anonymizedAt: null,
  updatedBy: 'admin-1',
  expectedVersion: 1,
  now: NOW,
};

describe('MembershipRepository', () => {
  let repo: MembershipRepository;
  let scope: ReturnType<typeof buildScope>;

  beforeEach(() => {
    repo = new MembershipRepository();
    scope = buildScope();
  });

  it('finds by id or returns null', async () => {
    scope.run.mockResolvedValueOnce([membershipRow()]);
    await expect(
      repo.findById(scope as never, 'team-1', 'mem-1'),
    ).resolves.toMatchObject({ id: 'mem-1', status: MembershipStatus.Active });

    scope.run.mockResolvedValueOnce([]);
    await expect(
      repo.findById(scope as never, 'team-1', 'missing'),
    ).resolves.toBeNull();
  });

  it('finds an active membership by user or returns null', async () => {
    scope.run.mockResolvedValueOnce([membershipRow()]);
    await expect(
      repo.findActiveByUser(scope as never, 'team-1', 'user-1'),
    ).resolves.not.toBeNull();

    scope.run.mockResolvedValueOnce([]);
    await expect(
      repo.findActiveByUser(scope as never, 'team-1', 'user-2'),
    ).resolves.toBeNull();
  });

  it('reports scoped membership existence', async () => {
    scope.run.mockResolvedValueOnce([{ id: 'mem-1' }]);
    await expect(
      repo.existsForUserScope(scope as never, 'team-1', 'user-1', null),
    ).resolves.toBe(true);

    scope.run.mockResolvedValueOnce([]);
    await expect(
      repo.existsForUserScope(scope as never, 'team-1', 'user-1', 'season-1'),
    ).resolves.toBe(false);
  });

  it('inserts an active membership setting joined_at', async () => {
    scope.run.mockResolvedValue([membershipRow()]);
    await repo.insert(scope as never, NEW_ACTIVE);
    expect(scope.run.mock.calls[0]?.[1]?.[6]).toBe(NOW.toISOString());
  });

  it('inserts an invited membership leaving joined_at null', async () => {
    scope.run.mockResolvedValue([membershipRow({ status: 'invited' })]);
    await repo.insert(scope as never, {
      ...NEW_ACTIVE,
      status: MembershipStatus.Invited,
    });
    expect(scope.run.mock.calls[0]?.[1]?.[6]).toBeNull();
  });

  it('throws when the insert returns no row', async () => {
    scope.run.mockResolvedValue([]);
    await expect(repo.insert(scope as never, NEW_ACTIVE)).rejects.toThrow(
      /returned row/u,
    );
  });

  it('applies a status change or returns null on version mismatch', async () => {
    scope.run.mockResolvedValueOnce([
      membershipRow({ status: 'left', version: 2 }),
    ]);
    await expect(
      repo.applyStatusChange(scope as never, CHANGE),
    ).resolves.toMatchObject({ status: MembershipStatus.Left, version: 2 });
    const params = scope.run.mock.calls[0]?.[1] ?? [];
    expect(params[4]).toBe(NOW.toISOString());
    expect(params[5]).toBe(NOW.toISOString());
    expect(params[6]).toBeNull();

    scope.run.mockResolvedValueOnce([]);
    await expect(
      repo.applyStatusChange(scope as never, CHANGE),
    ).resolves.toBeNull();
  });

  it('serializes a null joined_at and a non-null anonymized_at', async () => {
    scope.run.mockResolvedValueOnce([membershipRow({ status: 'anonymized' })]);
    await repo.applyStatusChange(scope as never, {
      ...CHANGE,
      toStatus: MembershipStatus.Anonymized,
      joinedAt: null,
      leftAt: null,
      anonymizedAt: NOW,
    });
    const params = scope.run.mock.calls[0]?.[1] ?? [];
    expect(params[4]).toBeNull();
    expect(params[6]).toBe(NOW.toISOString());
  });

  it('lists the directory with a total, defaulting the count to zero', async () => {
    scope.run.mockResolvedValueOnce([
      directoryRow(),
      directoryRow({ membership_id: 'mem-2' }),
    ]);
    scope.run.mockResolvedValueOnce([{ count: 2 }]);
    const page = await repo.listDirectory(scope as never, 'team-1', {
      limit: 20,
      offset: 0,
    });
    expect(page.total).toBe(2);
    expect(page.items[0]).toMatchObject({
      membershipId: 'mem-1',
      status: MembershipStatus.Active,
      hasAvatar: true,
    });

    scope.run.mockResolvedValueOnce([directoryRow()]);
    scope.run.mockResolvedValueOnce([]);
    const fallback = await repo.listDirectory(scope as never, 'team-1', {
      limit: 20,
      offset: 0,
    });
    expect(fallback.total).toBe(0);
  });

  it('left-joins the profile so account-only memberships appear with a fallback name', async () => {
    scope.run.mockResolvedValueOnce([
      directoryRow({ display_name: null, positions: null, has_avatar: false }),
    ]);
    scope.run.mockResolvedValueOnce([{ count: 1 }]);

    const page = await repo.listDirectory(scope as never, 'team-1', {
      limit: 20,
      offset: 0,
    });

    expect(page.items[0]).toMatchObject({
      displayName: 'Member',
      positions: [],
      hasAvatar: false,
    });
    const sql = String(scope.run.mock.calls[0]?.[0]);
    expect(sql).toContain('LEFT JOIN "member_profiles"');
    expect(sql).toContain('LEFT JOIN "users"');
  });

  it('lists invited unlinked memberships by profile email with an optional team filter', async () => {
    scope.run.mockResolvedValueOnce([
      membershipRow({ status: 'invited', user_id: null }),
    ]);
    const all = await repo.listInvitedUnlinkedByEmail(
      scope as never,
      'invitee@example.test',
      null,
    );
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({
      status: MembershipStatus.Invited,
      userId: null,
    });
    expect(scope.run.mock.calls[0]?.[1]).toEqual([
      'invitee@example.test',
      'invited',
      null,
      50,
    ]);

    scope.run.mockResolvedValueOnce([]);
    const scoped = await repo.listInvitedUnlinkedByEmail(
      scope as never,
      'invitee@example.test',
      'team-9',
    );
    expect(scoped).toEqual([]);
    expect(scope.run.mock.calls[1]?.[1]?.[2]).toBe('team-9');
  });

  it('links and activates an invited membership, or returns null when it moved on', async () => {
    scope.run.mockResolvedValueOnce([
      membershipRow({ status: 'active', version: 2 }),
    ]);
    const claim = {
      id: 'mem-1',
      userId: 'user-9',
      statusEffectiveAt: NOW,
      expectedVersion: 1,
      now: NOW,
    };
    await expect(
      repo.linkUserAndActivate(scope as never, claim),
    ).resolves.toMatchObject({ status: MembershipStatus.Active, version: 2 });
    const params = scope.run.mock.calls[0]?.[1] ?? [];
    expect(params).toEqual([
      'mem-1',
      'user-9',
      'active',
      NOW.toISOString(),
      NOW.toISOString(),
      1,
      'invited',
    ]);

    scope.run.mockResolvedValueOnce([]);
    await expect(
      repo.linkUserAndActivate(scope as never, claim),
    ).resolves.toBeNull();
  });
});
