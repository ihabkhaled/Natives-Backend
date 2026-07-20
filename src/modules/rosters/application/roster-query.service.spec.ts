import type {
  TransactionScope,
  UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import type { RosterRepository } from '../infrastructure/roster.repository';
import { RosterKind } from '../model/rosters.enums';
import type { Roster } from '../model/rosters.types';
import type { RosterLookupService } from './roster-lookup.service';
import { RosterQueryService } from './roster-query.service';

const TX = { run: vi.fn() } as unknown as TransactionScope;
const UOW: UnitOfWorkPort = { runInTransaction: operation => operation(TX) };
const FILTER = {
  competitionId: 'comp-1',
  fixtureId: null,
  rosterKind: RosterKind.Competition,
};

function build(items: Roster[], total: number): RosterQueryService {
  const repository = {
    listForScope: vi.fn().mockResolvedValue(items),
    countForScope: vi.fn().mockResolvedValue(total),
  } as unknown as RosterRepository;
  const lookup = {
    require: vi.fn().mockResolvedValue(items[0] ?? null),
  } as unknown as RosterLookupService;
  return new RosterQueryService(UOW, repository, lookup);
}

describe('RosterQueryService', () => {
  it('returns a bounded page echoing the requested window', async () => {
    const roster = { rosterId: 'roster-1' } as Roster;
    const page = await build([roster], 3).listForScope('team-1', FILTER, {
      limit: 20,
      offset: 10,
    });
    expect(page).toEqual({
      items: [roster],
      total: 3,
      limit: 20,
      offset: 10,
    });
  });

  it('returns an empty page without inventing a total', async () => {
    expect(
      await build([], 0).listForScope('team-1', FILTER, {
        limit: 5,
        offset: 0,
      }),
    ).toEqual({ items: [], total: 0, limit: 5, offset: 0 });
  });

  it('resolves one roster through the team-scoped lookup', async () => {
    const roster = { rosterId: 'roster-1' } as Roster;
    expect(await build([roster], 1).getById('team-1', 'roster-1')).toBe(roster);
  });
});
