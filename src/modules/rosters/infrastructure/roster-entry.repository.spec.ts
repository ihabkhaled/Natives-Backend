import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import {
  RosterAvailabilityStatus,
  RosterEntryRole,
  RosterEntryStatus,
  RosterGenderBucket,
  RosterLine,
  RosterPosition,
} from '../model/rosters.enums';
import type { RosterEntryRow } from '../model/rosters.rows';
import type { RosterEntryWrite } from '../model/rosters.types';
import { RosterEntryRepository } from './roster-entry.repository';

const NOW = new Date('2026-03-01T10:00:00.000Z');

function row(overrides: Partial<RosterEntryRow> = {}): RosterEntryRow {
  return {
    id: 'entry-1',
    roster_id: 'roster-1',
    team_id: 'team-1',
    membership_id: 'member-1',
    jersey_number: 7,
    entry_role: 'player',
    line_assignment: 'any',
    field_position: 'unspecified',
    gender_bucket: 'men',
    status: 'selected',
    availability: null,
    selection_reason: null,
    constraint_overridden: false,
    override_reason: null,
    overridden_by: null,
    selected_by: 'user-1',
    removed_by: null,
    removed_at: null,
    removal_reason: null,
    record_version: 1,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function scopeReturning(...results: RosterEntryRow[][]): {
  scope: TransactionScope;
  run: ReturnType<typeof vi.fn>;
} {
  const run = vi.fn();
  for (const result of results) {
    run.mockResolvedValueOnce(result);
  }
  return { scope: { run }, run };
}

function write(overrides: Partial<RosterEntryWrite> = {}): RosterEntryWrite {
  return {
    id: 'entry-1',
    rosterId: 'roster-1',
    teamId: 'team-1',
    membershipId: 'member-1',
    jerseyNumber: 7,
    entryRole: RosterEntryRole.Player,
    lineAssignment: RosterLine.Any,
    fieldPosition: RosterPosition.Unspecified,
    genderBucket: RosterGenderBucket.Men,
    availability: RosterAvailabilityStatus.Available,
    selectionReason: null,
    constraintOverridden: false,
    overrideReason: null,
    overriddenBy: null,
    selectedBy: 'user-1',
    now: NOW,
    ...overrides,
  };
}

describe('RosterEntryRepository', () => {
  const repository = new RosterEntryRepository();

  it('upserts an entry, reinstating a withdrawn one in place', async () => {
    const { scope, run } = scopeReturning([row()]);
    const entry = await repository.upsert(scope, write());
    expect(entry.membershipId).toBe('member-1');
    const statement = String(run.mock.calls[0]?.[0]);
    expect(statement).toContain('ON CONFLICT ("roster_id", "membership_id")');
    expect(statement).toContain(`"status" = 'selected'`);
    expect(statement).toContain('"removed_by" = NULL');
  });

  it('throws when the upsert returns no row', async () => {
    const { scope } = scopeReturning([]);
    await expect(repository.upsert(scope, write())).rejects.toThrow(
      'Expected a returned row',
    );
  });

  it('withdraws an entry without deleting it, or returns null when absent', async () => {
    const removed = scopeReturning([
      row({ status: 'withdrawn', removed_by: 'user-2', removed_at: NOW }),
    ]);
    const entry = await repository.softRemove(removed.scope, {
      rosterId: 'roster-1',
      membershipId: 'member-1',
      removedBy: 'user-2',
      reason: 'travelling',
      now: NOW,
    });
    expect(entry?.status).toBe(RosterEntryStatus.Withdrawn);
    expect(String(removed.run.mock.calls[0]?.[0])).toContain(
      'UPDATE "roster_entries"',
    );
    const absent = scopeReturning([]);
    expect(
      await repository.softRemove(absent.scope, {
        rosterId: 'roster-1',
        membershipId: 'member-9',
        removedBy: 'user-2',
        reason: null,
        now: NOW,
      }),
    ).toBeNull();
  });

  it('reads the active entries in a deterministic, bounded order', async () => {
    const { scope, run } = scopeReturning([row(), row({ id: 'entry-2' })]);
    expect(await repository.listActive(scope, 'roster-1')).toHaveLength(2);
    const statement = String(run.mock.calls[0]?.[0]);
    expect(statement).toContain(`"status" = 'selected'`);
    expect(statement).toContain('ORDER BY "membership_id" ASC');
    expect((run.mock.calls[0]?.[1] as unknown[])[1]).toBe(200);
  });

  it('finds the holder of a jersey or reports it free', async () => {
    const held = scopeReturning([row()]);
    expect(
      (await repository.findByJersey(held.scope, 'roster-1', 7))?.membershipId,
    ).toBe('member-1');
    const free = scopeReturning([]);
    expect(await repository.findByJersey(free.scope, 'roster-1', 8)).toBeNull();
  });

  it('counts active entries, defaulting a missing count to zero', async () => {
    const counted = { run: vi.fn().mockResolvedValue([{ count: 14 }]) };
    expect(
      await repository.countActive(
        counted as unknown as TransactionScope,
        'roster-1',
      ),
    ).toBe(14);
    const empty = { run: vi.fn().mockResolvedValue([]) };
    expect(
      await repository.countActive(
        empty as unknown as TransactionScope,
        'roster-1',
      ),
    ).toBe(0);
  });

  it('lists every entry — active and withdrawn — for a complete export', async () => {
    const { scope, run } = scopeReturning([
      row(),
      row({ id: 'entry-2', status: 'withdrawn' }),
    ]);
    const items = await repository.listForRoster(scope, 'roster-1', {
      limit: 9999,
      offset: 5,
    });
    expect(items).toHaveLength(2);
    expect(items[1]?.status).toBe(RosterEntryStatus.Withdrawn);
    const statement = String(run.mock.calls[0]?.[0]);
    expect(statement).not.toContain(`"status" = 'selected'`);
    expect((run.mock.calls[0]?.[1] as unknown[])[1]).toBe(200);
  });

  it('counts every entry of a roster, defaulting a missing count to zero', async () => {
    const counted = { run: vi.fn().mockResolvedValue([{ count: 3 }]) };
    expect(
      await repository.countForRoster(
        counted as unknown as TransactionScope,
        'roster-1',
      ),
    ).toBe(3);
    const empty = { run: vi.fn().mockResolvedValue([]) };
    expect(
      await repository.countForRoster(
        empty as unknown as TransactionScope,
        'roster-1',
      ),
    ).toBe(0);
  });
});
