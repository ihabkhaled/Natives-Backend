import { describe, expect, it, vi } from 'vitest';

import { AliasNotFoundError } from '../errors/alias-not-found.error';
import { AliasSource } from '../model/members.enums';
import type { MemberAlias } from '../model/members.types';
import { RemoveMemberAliasUseCase } from './remove-member-alias.use-case';

const SCOPE = {} as never;
const NOW = new Date('2026-06-01T12:00:00.000Z');
const ACTOR = { userId: 'admin-1', email: 'a@example.test', roles: [] };

const ALIAS: MemberAlias = {
  id: 'al-1',
  membershipId: 'mem-1',
  teamId: 'team-1',
  alias: 'Speedy',
  normalizedAlias: 'speedy',
  source: AliasSource.Manual,
  createdBy: 'admin-1',
  createdAt: NOW,
  deletedAt: null,
};

function build(found: MemberAlias | null) {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const idGenerator = { generate: vi.fn().mockReturnValue('gen') };
  const lookup = { requireMembership: vi.fn().mockResolvedValue({}) };
  const aliases = {
    findActiveById: vi.fn().mockResolvedValue(found),
    softDelete: vi.fn().mockResolvedValue(true),
  };
  const audit = { append: vi.fn() };
  const useCase = new RemoveMemberAliasUseCase(
    unitOfWork as never,
    clock,
    idGenerator,
    lookup as never,
    aliases as never,
    audit,
  );
  return { useCase, aliases, audit };
}

describe('RemoveMemberAliasUseCase', () => {
  it('throws when the alias is unknown or already removed', async () => {
    const { useCase } = build(null);
    await expect(
      useCase.execute(ACTOR, 'team-1', 'mem-1', 'al-1'),
    ).rejects.toBeInstanceOf(AliasNotFoundError);
  });

  it('soft-deletes the alias and audits the removal', async () => {
    const { useCase, aliases, audit } = build(ALIAS);
    await useCase.execute(ACTOR, 'team-1', 'mem-1', 'al-1');
    expect(aliases.softDelete).toHaveBeenCalledWith(SCOPE, 'al-1', NOW);
    expect(audit.append).toHaveBeenCalledOnce();
  });
});
