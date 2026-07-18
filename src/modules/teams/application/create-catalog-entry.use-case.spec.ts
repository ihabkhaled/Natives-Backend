import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SlugConflictError } from '../errors/slug-conflict.error';
import { CatalogName, ResourceStatus } from '../model/teams.enums';
import type { CatalogEntry } from '../model/teams.types';
import { CreateCatalogEntryUseCase } from './create-catalog-entry.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const ACTOR = { userId: 'admin-1', email: 'a@example.test', roles: [] };
const SCOPE = {} as never;

const ENTRY: CatalogEntry = {
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
};

const COMMAND = {
  catalog: CatalogName.Position,
  key: 'handler',
  label: 'Handler',
  sortOrder: null,
  metadata: null,
};

function build() {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const idGenerator = { generate: vi.fn().mockReturnValue('generated') };
  const teamLookup = { requireActive: vi.fn().mockResolvedValue(undefined) };
  const catalog = {
    existsByKey: vi.fn().mockResolvedValue(false),
    insert: vi.fn().mockResolvedValue(ENTRY),
  };
  const audit = { append: vi.fn() };
  const useCase = new CreateCatalogEntryUseCase(
    unitOfWork as never,
    clock,
    idGenerator,
    teamLookup as never,
    catalog as never,
    audit,
  );
  return { useCase, catalog, audit };
}

describe('CreateCatalogEntryUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('creates an entry, defaulting sort order and metadata, and audits', async () => {
    const result = await harness.useCase.execute(ACTOR, 'team-1', COMMAND);
    expect(result).toBe(ENTRY);
    expect(harness.catalog.insert.mock.calls[0]?.[1]).toMatchObject({
      sortOrder: 0,
      metadata: {},
    });
    expect(harness.audit.append).toHaveBeenCalledOnce();
  });

  it('rejects a duplicate key', async () => {
    harness.catalog.existsByKey.mockResolvedValue(true);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', {
        ...COMMAND,
        sortOrder: 5,
        metadata: { line: 'offense' },
      }),
    ).rejects.toBeInstanceOf(SlugConflictError);
  });
});
