import { ValidationError } from '@core/errors/validation.error';
import { describe, expect, it, vi } from 'vitest';

import { AliasConflictError } from '../errors/alias-conflict.error';
import { AliasSource } from '../model/members.enums';
import type { MemberAlias } from '../model/members.types';
import { AddMemberAliasUseCase } from './add-member-alias.use-case';

const SCOPE = {} as never;
const NOW = new Date('2026-06-01T12:00:00.000Z');
const ACTOR = { userId: 'admin-1', email: 'a@example.test', roles: [] };

const ALIAS: MemberAlias = {
  id: 'al-1',
  membershipId: 'mem-1',
  teamId: 'team-1',
  alias: 'José García',
  normalizedAlias: 'jose garcia',
  source: AliasSource.Manual,
  createdBy: 'admin-1',
  createdAt: NOW,
  deletedAt: null,
};

function build(existing: MemberAlias | null) {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const idGenerator = { generate: vi.fn().mockReturnValue('gen') };
  const lookup = { requireMembership: vi.fn().mockResolvedValue({}) };
  const aliases = {
    findActiveByNormalized: vi.fn().mockResolvedValue(existing),
    insert: vi.fn().mockResolvedValue(ALIAS),
  };
  const audit = { append: vi.fn() };
  const useCase = new AddMemberAliasUseCase(
    unitOfWork as never,
    clock,
    idGenerator,
    lookup as never,
    aliases as never,
    audit,
  );
  return { useCase, aliases, audit };
}

describe('AddMemberAliasUseCase', () => {
  it('rejects an alias that is empty after normalization', async () => {
    const { useCase } = build(null);
    await expect(
      useCase.execute(ACTOR, 'team-1', 'mem-1', {
        alias: '   ',
        source: null,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects a normalized alias already in use', async () => {
    const { useCase } = build(ALIAS);
    await expect(
      useCase.execute(ACTOR, 'team-1', 'mem-1', {
        alias: 'Jose Garcia',
        source: null,
      }),
    ).rejects.toBeInstanceOf(AliasConflictError);
  });

  it('adds an alias with a normalized key and default manual source', async () => {
    const { useCase, aliases, audit } = build(null);
    const response = await useCase.execute(ACTOR, 'team-1', 'mem-1', {
      alias: 'José García',
      source: null,
    });
    expect(response.alias).toBe('José García');
    const inserted = aliases.insert.mock.calls[0]?.[1];
    expect(inserted.normalizedAlias).toBe('jose garcia');
    expect(inserted.source).toBe(AliasSource.Manual);
    expect(audit.append).toHaveBeenCalledOnce();
  });

  it('honors an explicit import source', async () => {
    const { useCase, aliases } = build(null);
    await useCase.execute(ACTOR, 'team-1', 'mem-1', {
      alias: 'Handler One',
      source: AliasSource.Import,
    });
    expect(aliases.insert.mock.calls[0]?.[1].source).toBe(AliasSource.Import);
  });
});
