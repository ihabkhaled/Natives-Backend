import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CatalogEntryInUseError } from '../errors/catalog-entry-in-use.error';
import { CatalogEntryNotFoundError } from '../errors/catalog-entry-not-found.error';
import { CatalogName, ResourceStatus } from '../model/teams.enums';
import type { CatalogEntry } from '../model/teams.types';
import { ArchiveCatalogEntryUseCase } from './archive-catalog-entry.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const ACTOR = { userId: 'admin-1', email: 'a@example.test', roles: [] };
const SCOPE = {} as never;

function entry(overrides: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    id: 'entry-1',
    teamId: 'team-1',
    catalog: CatalogName.Position,
    key: 'handler',
    label: 'Handler',
    sortOrder: 0,
    metadata: {},
    referenceCount: 0,
    status: ResourceStatus.Active,
    createdBy: 'admin-1',
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    ...overrides,
  };
}

function build() {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const idGenerator = { generate: vi.fn().mockReturnValue('generated') };
  const catalog = { findByIdInTeam: vi.fn(), archive: vi.fn() };
  const audit = { append: vi.fn() };
  const useCase = new ArchiveCatalogEntryUseCase(
    unitOfWork as never,
    clock,
    idGenerator,
    catalog as never,
    audit,
  );
  return { useCase, catalog, audit };
}

function run(harness: ReturnType<typeof build>) {
  return harness.useCase.execute(ACTOR, 'team-1', 'entry-1');
}

describe('ArchiveCatalogEntryUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('archives an unreferenced entry and audits', async () => {
    harness.catalog.findByIdInTeam.mockResolvedValue(entry());
    harness.catalog.archive.mockResolvedValue(
      entry({ status: ResourceStatus.Archived, version: 2 }),
    );
    const result = await run(harness);
    expect(result.status).toBe(ResourceStatus.Archived);
    expect(harness.audit.append).toHaveBeenCalledOnce();
  });

  it('reports not-found for a missing or cross-team entry', async () => {
    harness.catalog.findByIdInTeam.mockResolvedValue(null);
    await expect(run(harness)).rejects.toBeInstanceOf(
      CatalogEntryNotFoundError,
    );
  });

  it('blocks archiving a referenced entry', async () => {
    harness.catalog.findByIdInTeam.mockResolvedValue(
      entry({ referenceCount: 3 }),
    );
    await expect(run(harness)).rejects.toBeInstanceOf(CatalogEntryInUseError);
    expect(harness.catalog.archive).not.toHaveBeenCalled();
  });

  it('reports not-found when the guarded archive loses a race', async () => {
    harness.catalog.findByIdInTeam.mockResolvedValue(entry());
    harness.catalog.archive.mockResolvedValue(null);
    await expect(run(harness)).rejects.toBeInstanceOf(
      CatalogEntryNotFoundError,
    );
  });
});
