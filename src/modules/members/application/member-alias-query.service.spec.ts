import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AliasSource } from '../model/members.enums';
import type { MemberAlias } from '../model/members.types';
import { MemberAliasQueryService } from './member-alias-query.service';

const SCOPE = {} as never;
const NOW = new Date('2026-06-01T00:00:00.000Z');

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

function build() {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const lookup = { requireMembership: vi.fn().mockResolvedValue({}) };
  const aliases = { listByMembership: vi.fn().mockResolvedValue([ALIAS]) };
  const service = new MemberAliasQueryService(
    unitOfWork as never,
    lookup as never,
    aliases as never,
  );
  return { service, lookup, aliases };
}

describe('MemberAliasQueryService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('lists aliases as projections without internal fields', async () => {
    const result = await harness.service.listAliases('team-1', 'mem-1');
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual({
      id: 'al-1',
      membershipId: 'mem-1',
      alias: 'Speedy',
      source: AliasSource.Manual,
      createdAt: NOW,
    });
    expect(harness.lookup.requireMembership).toHaveBeenCalledWith(
      SCOPE,
      'team-1',
      'mem-1',
    );
  });
});
