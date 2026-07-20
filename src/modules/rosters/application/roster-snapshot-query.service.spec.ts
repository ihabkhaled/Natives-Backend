import type {
  TransactionScope,
  UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import type { RosterSnapshotRepository } from '../infrastructure/roster-snapshot.repository';
import type { RosterSnapshot } from '../model/rosters.types';
import type { RosterLookupService } from './roster-lookup.service';
import { RosterSnapshotQueryService } from './roster-snapshot-query.service';

const TX = { run: vi.fn() } as unknown as TransactionScope;
const UOW: UnitOfWorkPort = { runInTransaction: operation => operation(TX) };

function build(
  items: RosterSnapshot[],
  total: number,
): { service: RosterSnapshotQueryService; list: ReturnType<typeof vi.fn> } {
  const lookup = {
    require: vi.fn().mockResolvedValue({ rosterId: 'roster-1' }),
  } as unknown as RosterLookupService;
  const list = vi.fn().mockResolvedValue(items);
  const snapshots = {
    listForRoster: list,
    countForRoster: vi.fn().mockResolvedValue(total),
  } as unknown as RosterSnapshotRepository;
  return {
    service: new RosterSnapshotQueryService(UOW, lookup, snapshots),
    list,
  };
}

describe('RosterSnapshotQueryService', () => {
  it('returns the frozen snapshots exactly as recorded', async () => {
    const snapshot = {
      snapshotId: 'snap-1',
      checksum: 'abc',
    } as RosterSnapshot;
    const { service } = build([snapshot], 2);
    const page = await service.listForRoster('team-1', 'roster-1', {
      limit: 50,
      offset: 0,
    });
    expect(page.items[0]).toBe(snapshot);
    expect(page.total).toBe(2);
  });

  it('reads through the team-scoped roster id, never a caller-supplied one', async () => {
    const { service, list } = build([], 0);
    await service.listForRoster('team-1', 'roster-9', {
      limit: 10,
      offset: 0,
    });
    expect(list).toHaveBeenCalledWith(TX, 'roster-1', {
      limit: 10,
      offset: 0,
    });
  });
});
