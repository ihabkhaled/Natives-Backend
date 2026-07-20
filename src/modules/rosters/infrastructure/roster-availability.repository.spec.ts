import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import {
  RosterAvailabilitySource,
  RosterAvailabilityStatus,
} from '../model/rosters.enums';
import type { RosterAvailabilityRow } from '../model/rosters.rows';
import type { RosterAvailabilityUpsert } from '../model/rosters.types';
import { RosterAvailabilityRepository } from './roster-availability.repository';

const NOW = new Date('2026-03-01T10:00:00.000Z');

function row(
  overrides: Partial<RosterAvailabilityRow> = {},
): RosterAvailabilityRow {
  return {
    id: 'av-1',
    roster_id: 'roster-1',
    team_id: 'team-1',
    membership_id: 'member-1',
    availability: 'available',
    reason: null,
    source: 'self',
    declared_by: 'user-1',
    record_version: 1,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function scopeReturning(...results: RosterAvailabilityRow[][]): {
  scope: TransactionScope;
  run: ReturnType<typeof vi.fn>;
} {
  const run = vi.fn();
  for (const result of results) {
    run.mockResolvedValueOnce(result);
  }
  return { scope: { run }, run };
}

function upsert(): RosterAvailabilityUpsert {
  return {
    id: 'av-1',
    rosterId: 'roster-1',
    teamId: 'team-1',
    membershipId: 'member-1',
    availability: RosterAvailabilityStatus.Available,
    reason: null,
    source: RosterAvailabilitySource.Self,
    declaredBy: 'user-1',
    now: NOW,
  };
}

describe('RosterAvailabilityRepository', () => {
  const repository = new RosterAvailabilityRepository();

  it('upserts one declaration per member and bumps the record version', async () => {
    const { scope, run } = scopeReturning([row({ record_version: 2 })]);
    const declared = await repository.upsert(scope, upsert());
    expect(declared.recordVersion).toBe(2);
    const statement = String(run.mock.calls[0]?.[0]);
    expect(statement).toContain('ON CONFLICT ("roster_id", "membership_id")');
    expect(statement).toContain('"record_version" + 1');
  });

  it('throws when the upsert returns no row', async () => {
    const { scope } = scopeReturning([]);
    await expect(repository.upsert(scope, upsert())).rejects.toThrow(
      'Expected a returned row',
    );
  });

  it('lists and counts declarations in a bounded, ordered window', async () => {
    const list = scopeReturning([row(), row({ id: 'av-2' })]);
    expect(
      await repository.listForRoster(list.scope, 'roster-1', {
        limit: 9999,
        offset: 2,
      }),
    ).toHaveLength(2);
    expect((list.run.mock.calls[0]?.[1] as unknown[])[1]).toBe(200);
    const counted = { run: vi.fn().mockResolvedValue([{ count: 5 }]) };
    expect(
      await repository.countForRoster(
        counted as unknown as TransactionScope,
        'roster-1',
      ),
    ).toBe(5);
    const empty = { run: vi.fn().mockResolvedValue([]) };
    expect(
      await repository.countForRoster(
        empty as unknown as TransactionScope,
        'roster-1',
      ),
    ).toBe(0);
  });
});
