import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CatalogName, ResourceStatus } from '../model/teams.enums';
import type { CatalogEntryRow } from '../model/teams.rows';
import type { NewCatalogEntry } from '../model/teams.types';
import { CatalogRepository } from './catalog.repository';

const NOW = new Date('2026-06-01T12:00:00.000Z');

function buildScope() {
  return { run: vi.fn() };
}

function entryRow(overrides: Partial<CatalogEntryRow> = {}): CatalogEntryRow {
  return {
    id: 'entry-1',
    team_id: 'team-1',
    catalog: 'position',
    key: 'handler',
    label: 'Handler',
    sort_order: 0,
    metadata: { line: 'offense' },
    reference_count: 0,
    status: 'active',
    created_by: 'admin-1',
    updated_by: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    version: 1,
    ...overrides,
  };
}

const NEW_ENTRY: NewCatalogEntry = {
  id: 'entry-1',
  teamId: 'team-1',
  catalog: CatalogName.Position,
  key: 'handler',
  label: 'Handler',
  sortOrder: 0,
  metadata: { line: 'offense' },
  createdBy: 'admin-1',
  now: NOW,
};

describe('CatalogRepository', () => {
  let repository: CatalogRepository;
  let scope: ReturnType<typeof buildScope>;

  beforeEach(() => {
    repository = new CatalogRepository();
    scope = buildScope();
  });

  it('finds an entry within a team or returns null', async () => {
    scope.run.mockResolvedValueOnce([entryRow({ reference_count: 3 })]);
    await expect(
      repository.findByIdInTeam(scope as never, 'team-1', 'entry-1'),
    ).resolves.toMatchObject({
      catalog: CatalogName.Position,
      referenceCount: 3,
      metadata: { line: 'offense' },
    });

    scope.run.mockResolvedValueOnce([]);
    await expect(
      repository.findByIdInTeam(scope as never, 'team-1', 'other'),
    ).resolves.toBeNull();
  });

  it('reports key existence within a catalog', async () => {
    scope.run.mockResolvedValueOnce([{ id: 'entry-1' }]);
    await expect(
      repository.existsByKey(scope as never, 'team-1', 'position', 'handler'),
    ).resolves.toBe(true);

    scope.run.mockResolvedValueOnce([]);
    await expect(
      repository.existsByKey(scope as never, 'team-1', 'position', 'ghost'),
    ).resolves.toBe(false);
  });

  it('lists active keys of a catalog with a bounded scan', async () => {
    scope.run.mockResolvedValueOnce([{ key: 'cutter' }, { key: 'handler' }]);
    await expect(
      repository.listActiveKeys(scope as never, 'team-1', 'position'),
    ).resolves.toEqual(['cutter', 'handler']);
    expect(scope.run.mock.calls[0]?.[0]).toContain(`"status" = 'active'`);
    expect(scope.run.mock.calls[0]?.[0]).toContain('LIMIT');

    scope.run.mockResolvedValueOnce([]);
    await expect(
      repository.listActiveKeys(scope as never, 'team-1', 'position'),
    ).resolves.toEqual([]);
  });

  it('inserts an entry and serializes metadata as jsonb', async () => {
    scope.run.mockResolvedValue([entryRow()]);
    await repository.insert(scope as never, NEW_ENTRY);
    expect(scope.run.mock.calls[0]?.[1]?.[6]).toBe(
      JSON.stringify({ line: 'offense' }),
    );
  });

  it('throws when the insert returns no row', async () => {
    scope.run.mockResolvedValue([]);
    await expect(repository.insert(scope as never, NEW_ENTRY)).rejects.toThrow(
      /returned row/u,
    );
  });

  it('archives an entry or returns null when already archived', async () => {
    scope.run.mockResolvedValueOnce([entryRow({ status: 'archived' })]);
    await expect(
      repository.archive(scope as never, 'team-1', 'entry-1', 'admin-1', NOW),
    ).resolves.toMatchObject({ status: ResourceStatus.Archived });

    scope.run.mockResolvedValueOnce([]);
    await expect(
      repository.archive(scope as never, 'team-1', 'entry-1', 'admin-1', NOW),
    ).resolves.toBeNull();
  });

  it('lists entries with a total, defaulting the count to zero', async () => {
    scope.run.mockResolvedValueOnce([entryRow()]);
    scope.run.mockResolvedValueOnce([{ count: 1 }]);
    await expect(
      repository.list(scope as never, 'team-1', 'position', {
        limit: 20,
        offset: 0,
      }),
    ).resolves.toMatchObject({ total: 1 });

    scope.run.mockResolvedValueOnce([]);
    scope.run.mockResolvedValueOnce([]);
    const fallback = await repository.list(
      scope as never,
      'team-1',
      'position',
      {
        limit: 20,
        offset: 0,
      },
    );
    expect(fallback.total).toBe(0);
  });
});
