import type {
  TransactionScope,
  UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import type { RosterEntryRepository } from '../infrastructure/roster-entry.repository';
import { RosterEntryStatus } from '../model/rosters.enums';
import type { RosterEntry } from '../model/rosters.types';
import { RosterEntryQueryService } from './roster-entry-query.service';
import type { RosterLookupService } from './roster-lookup.service';

const TX = { run: vi.fn() } as unknown as TransactionScope;
const UOW: UnitOfWorkPort = { runInTransaction: operation => operation(TX) };

function build(items: RosterEntry[], total: number): RosterEntryQueryService {
  const lookup = {
    require: vi.fn().mockResolvedValue({ rosterId: 'roster-1' }),
  } as unknown as RosterLookupService;
  const entries = {
    listForRoster: vi.fn().mockResolvedValue(items),
    countForRoster: vi.fn().mockResolvedValue(total),
  } as unknown as RosterEntryRepository;
  return new RosterEntryQueryService(UOW, lookup, entries);
}

describe('RosterEntryQueryService', () => {
  it('returns active and withdrawn entries so nobody disappears from an export', async () => {
    const active = {
      entryId: 'entry-1',
      status: RosterEntryStatus.Selected,
    } as RosterEntry;
    const withdrawn = {
      entryId: 'entry-2',
      status: RosterEntryStatus.Withdrawn,
    } as RosterEntry;
    const page = await build([active, withdrawn], 2).listForRoster(
      'team-1',
      'roster-1',
      { limit: 100, offset: 0 },
    );
    expect(page.items).toEqual([active, withdrawn]);
    expect(page.total).toBe(2);
  });

  it('echoes the bounded window and never invents a total', async () => {
    expect(
      await build([], 0).listForRoster('team-1', 'roster-1', {
        limit: 25,
        offset: 50,
      }),
    ).toEqual({ items: [], total: 0, limit: 25, offset: 50 });
  });
});
