import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TeamStatus } from '../model/teams.enums';
import type { TeamRow } from '../model/teams.rows';
import type {
  NewTeam,
  TeamRemoval,
  TeamStatusChange,
  TeamUpdate,
} from '../model/teams.types';
import { TeamRepository } from './team.repository';

const NOW = new Date('2026-06-01T12:00:00.000Z');

function buildScope() {
  return { run: vi.fn() };
}

function teamRow(overrides: Partial<TeamRow> = {}): TeamRow {
  return {
    id: 'team-1',
    slug: 'natives',
    name: 'Ultimate Natives',
    locale: 'en',
    timezone: 'Africa/Cairo',
    primary_color: null,
    logo_media_key: null,
    status: 'active',
    deleted_at: null,
    created_by: 'admin-1',
    updated_by: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    version: 1,
    ...overrides,
  };
}

const NEW_TEAM: NewTeam = {
  id: 'team-1',
  slug: 'natives',
  name: 'Ultimate Natives',
  locale: 'en',
  timezone: 'Africa/Cairo',
  primaryColor: null,
  logoMediaKey: null,
  createdBy: 'admin-1',
  now: NOW,
};

const TEAM_UPDATE: TeamUpdate = {
  id: 'team-1',
  name: 'Renamed',
  locale: 'ar',
  timezone: 'Africa/Cairo',
  primaryColor: '#123456',
  logoMediaKey: null,
  updatedBy: 'admin-1',
  expectedVersion: 1,
  now: NOW,
};

const STATUS_CHANGE: TeamStatusChange = {
  id: 'team-1',
  status: TeamStatus.Archived,
  updatedBy: 'admin-1',
  expectedVersion: 1,
  now: NOW,
};

const REMOVAL: TeamRemoval = {
  id: 'team-1',
  updatedBy: 'admin-1',
  expectedVersion: 1,
  now: NOW,
};

describe('TeamRepository', () => {
  let repository: TeamRepository;
  let scope: ReturnType<typeof buildScope>;

  beforeEach(() => {
    repository = new TeamRepository();
    scope = buildScope();
  });

  it('finds a team by id or returns null', async () => {
    scope.run.mockResolvedValueOnce([teamRow({ primary_color: '#fff' })]);
    await expect(
      repository.findById(scope as never, 'team-1'),
    ).resolves.toMatchObject({
      id: 'team-1',
      status: TeamStatus.Active,
      primaryColor: '#fff',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    scope.run.mockResolvedValueOnce([]);
    await expect(
      repository.findById(scope as never, 'missing'),
    ).resolves.toBeNull();
  });

  it('reports slug existence', async () => {
    scope.run.mockResolvedValueOnce([{ id: 'team-1' }]);
    await expect(
      repository.existsBySlug(scope as never, 'natives'),
    ).resolves.toBe(true);

    scope.run.mockResolvedValueOnce([]);
    await expect(
      repository.existsBySlug(scope as never, 'ghost'),
    ).resolves.toBe(false);
  });

  it('inserts a team and maps the returned row', async () => {
    scope.run.mockResolvedValue([teamRow()]);
    const result = await repository.insert(scope as never, NEW_TEAM);
    expect(result.slug).toBe('natives');
    expect(scope.run.mock.calls[0]?.[1]?.[0]).toBe('team-1');
  });

  it('throws when the insert returns no row', async () => {
    scope.run.mockResolvedValue([]);
    await expect(repository.insert(scope as never, NEW_TEAM)).rejects.toThrow(
      /returned row/u,
    );
  });

  it('updates a team or returns null on version mismatch', async () => {
    scope.run.mockResolvedValueOnce([teamRow({ name: 'Renamed', version: 2 })]);
    await expect(
      repository.update(scope as never, TEAM_UPDATE),
    ).resolves.toMatchObject({ name: 'Renamed', version: 2 });

    scope.run.mockResolvedValueOnce([]);
    await expect(
      repository.update(scope as never, TEAM_UPDATE),
    ).resolves.toBeNull();
  });

  it('applies a lifecycle status change or returns null on a version miss', async () => {
    scope.run.mockResolvedValueOnce([teamRow({ status: 'archived' })]);
    await expect(
      repository.applyStatusChange(scope as never, STATUS_CHANGE),
    ).resolves.toMatchObject({ status: TeamStatus.Archived });
    expect(scope.run.mock.calls[0]?.[0]).toContain('"deleted_at" IS NULL');

    scope.run.mockResolvedValueOnce([]);
    await expect(
      repository.applyStatusChange(scope as never, STATUS_CHANGE),
    ).resolves.toBeNull();
  });

  it('skips the optimistic guard when no expected version is supplied', async () => {
    scope.run.mockResolvedValueOnce([teamRow({ status: 'archived' })]);

    await repository.applyStatusChange(scope as never, {
      ...STATUS_CHANGE,
      expectedVersion: null,
    });

    expect(scope.run.mock.calls[0]?.[0]).toContain('$5::int IS NULL');
    expect(scope.run.mock.calls[0]?.[1]?.[4]).toBeNull();
  });

  it('soft-removes a team by stamping deleted_at, never deleting the row', async () => {
    scope.run.mockResolvedValueOnce([
      teamRow({ status: 'archived', deleted_at: NOW }),
    ]);

    const removed = await repository.softRemove(scope as never, REMOVAL);

    expect(removed?.deletedAt).toEqual(NOW);
    expect(scope.run.mock.calls[0]?.[0]).toContain('UPDATE "teams"');
    expect(scope.run.mock.calls[0]?.[0]).not.toContain('DELETE');

    scope.run.mockResolvedValueOnce([]);
    await expect(
      repository.softRemove(scope as never, REMOVAL),
    ).resolves.toBeNull();
  });

  it('lists only the teams the principal holds a live assignment in', async () => {
    scope.run.mockResolvedValueOnce([teamRow()]);
    scope.run.mockResolvedValueOnce([{ count: 1 }]);

    const page = await repository.listForUser(scope as never, 'user-1', {
      limit: 20,
      offset: 0,
    });

    expect(page.total).toBe(1);
    expect(scope.run.mock.calls[0]?.[0]).toContain('user_role_assignments');
    expect(scope.run.mock.calls[0]?.[1]?.[0]).toBe('user-1');

    scope.run.mockResolvedValueOnce([teamRow()]);
    scope.run.mockResolvedValueOnce([]);
    await expect(
      repository.listForUser(scope as never, 'user-1', {
        limit: 20,
        offset: 0,
      }),
    ).resolves.toMatchObject({ total: 0 });
  });

  it('lists teams with a total, defaulting the count to zero', async () => {
    scope.run.mockResolvedValueOnce([teamRow(), teamRow({ id: 't2' })]);
    scope.run.mockResolvedValueOnce([{ count: 2 }]);
    await expect(
      repository.list(scope as never, { limit: 20, offset: 0 }),
    ).resolves.toMatchObject({ total: 2, limit: 20, offset: 0 });

    scope.run.mockResolvedValueOnce([teamRow()]);
    scope.run.mockResolvedValueOnce([]);
    const fallback = await repository.list(scope as never, {
      limit: 20,
      offset: 0,
    });
    expect(fallback.total).toBe(0);
  });
});
