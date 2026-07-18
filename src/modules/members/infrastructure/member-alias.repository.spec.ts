import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AliasSource } from '../model/members.enums';
import type { AliasRow } from '../model/members.rows';
import type { NewAlias } from '../model/members.types';
import { MemberAliasRepository } from './member-alias.repository';

const NOW = new Date('2026-06-01T12:00:00.000Z');

function buildScope() {
  return { run: vi.fn() };
}

function aliasRow(overrides: Partial<AliasRow> = {}): AliasRow {
  return {
    id: 'al-1',
    membership_id: 'mem-1',
    team_id: 'team-1',
    alias: 'Speedy',
    normalized_alias: 'speedy',
    source: 'manual',
    created_by: 'admin-1',
    created_at: NOW.toISOString(),
    deleted_at: null,
    ...overrides,
  };
}

const NEW_ALIAS: NewAlias = {
  id: 'al-1',
  membershipId: 'mem-1',
  teamId: 'team-1',
  alias: 'Speedy',
  normalizedAlias: 'speedy',
  source: AliasSource.Manual,
  createdBy: 'admin-1',
  now: NOW,
};

describe('MemberAliasRepository', () => {
  let repo: MemberAliasRepository;
  let scope: ReturnType<typeof buildScope>;

  beforeEach(() => {
    repo = new MemberAliasRepository();
    scope = buildScope();
  });

  it('finds an active alias by normalized key or returns null', async () => {
    scope.run.mockResolvedValueOnce([aliasRow()]);
    await expect(
      repo.findActiveByNormalized(scope as never, 'team-1', 'speedy'),
    ).resolves.toMatchObject({ normalizedAlias: 'speedy' });

    scope.run.mockResolvedValueOnce([]);
    await expect(
      repo.findActiveByNormalized(scope as never, 'team-1', 'ghost'),
    ).resolves.toBeNull();
  });

  it('finds an active alias by id or returns null', async () => {
    scope.run.mockResolvedValueOnce([aliasRow()]);
    await expect(
      repo.findActiveById(scope as never, 'mem-1', 'al-1'),
    ).resolves.not.toBeNull();

    scope.run.mockResolvedValueOnce([]);
    await expect(
      repo.findActiveById(scope as never, 'mem-1', 'al-2'),
    ).resolves.toBeNull();
  });

  it('inserts an alias and maps the row', async () => {
    scope.run.mockResolvedValueOnce([aliasRow()]);
    await expect(repo.insert(scope as never, NEW_ALIAS)).resolves.toMatchObject(
      { source: AliasSource.Manual },
    );
  });

  it('throws when the insert returns no row', async () => {
    scope.run.mockResolvedValueOnce([]);
    await expect(repo.insert(scope as never, NEW_ALIAS)).rejects.toThrow(
      /returned row/u,
    );
  });

  it('soft-deletes an alias, reporting whether a row changed', async () => {
    scope.run.mockResolvedValueOnce([
      aliasRow({ deleted_at: NOW.toISOString() }),
    ]);
    await expect(repo.softDelete(scope as never, 'al-1', NOW)).resolves.toBe(
      true,
    );

    scope.run.mockResolvedValueOnce([]);
    await expect(repo.softDelete(scope as never, 'al-1', NOW)).resolves.toBe(
      false,
    );
  });

  it('soft-deletes every active alias for a membership', async () => {
    scope.run.mockResolvedValueOnce([]);
    await repo.softDeleteAllForMembership(scope as never, 'mem-1', NOW);
    expect(scope.run.mock.calls[0]?.[1]).toEqual(['mem-1', NOW.toISOString()]);
  });

  it('lists active aliases for a membership', async () => {
    scope.run.mockResolvedValueOnce([aliasRow(), aliasRow({ id: 'al-2' })]);
    await expect(
      repo.listByMembership(scope as never, 'mem-1', 200),
    ).resolves.toHaveLength(2);
  });
});
