import type {
  TransactionScope,
  UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import type { RosterAvailabilityRepository } from '../infrastructure/roster-availability.repository';
import type { RosterAvailabilityRecord } from '../model/rosters.types';
import { RosterAvailabilityQueryService } from './roster-availability-query.service';
import type { RosterLookupService } from './roster-lookup.service';

const TX = { run: vi.fn() } as unknown as TransactionScope;
const UOW: UnitOfWorkPort = { runInTransaction: operation => operation(TX) };

function build(
  items: RosterAvailabilityRecord[],
  total: number,
): RosterAvailabilityQueryService {
  const lookup = {
    require: vi.fn().mockResolvedValue({ rosterId: 'roster-1' }),
  } as unknown as RosterLookupService;
  const availability = {
    listForRoster: vi.fn().mockResolvedValue(items),
    countForRoster: vi.fn().mockResolvedValue(total),
  } as unknown as RosterAvailabilityRepository;
  return new RosterAvailabilityQueryService(UOW, lookup, availability);
}

describe('RosterAvailabilityQueryService', () => {
  it('returns the declarations that exist, never a row for the silent', async () => {
    const declared = { availabilityId: 'av-1' } as RosterAvailabilityRecord;
    const page = await build([declared], 1).listForRoster(
      'team-1',
      'roster-1',
      { limit: 100, offset: 0 },
    );
    expect(page.items).toEqual([declared]);
    expect(page.total).toBe(1);
  });

  it('echoes the bounded window on an empty roster', async () => {
    expect(
      await build([], 0).listForRoster('team-1', 'roster-1', {
        limit: 10,
        offset: 20,
      }),
    ).toEqual({ items: [], total: 0, limit: 10, offset: 20 });
  });
});
