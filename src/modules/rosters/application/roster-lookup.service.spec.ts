import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import { RosterNotFoundError } from '../errors/roster-not-found.error';
import type { RosterRepository } from '../infrastructure/roster.repository';
import type { Roster } from '../model/rosters.types';
import { RosterLookupService } from './roster-lookup.service';

const TX = { run: vi.fn() } as unknown as TransactionScope;

function build(found: Roster | null): {
  service: RosterLookupService;
  findForWrite: ReturnType<typeof vi.fn>;
} {
  const findForWrite = vi.fn().mockResolvedValue(found);
  const repository = { findForWrite } as unknown as RosterRepository;
  return { service: new RosterLookupService(repository), findForWrite };
}

describe('RosterLookupService', () => {
  it('returns the team’s own roster', async () => {
    const roster = { rosterId: 'roster-1' } as Roster;
    const { service, findForWrite } = build(roster);
    expect(await service.require(TX, 'team-1', 'roster-1')).toBe(roster);
    expect(findForWrite).toHaveBeenCalledWith(TX, 'team-1', 'roster-1');
  });

  it('hides another team’s roster behind a not-found error', async () => {
    const { service } = build(null);
    await expect(
      service.require(TX, 'other-team', 'roster-1'),
    ).rejects.toBeInstanceOf(RosterNotFoundError);
  });
});
