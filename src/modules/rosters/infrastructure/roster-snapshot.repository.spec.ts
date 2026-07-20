import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import {
  RosterEntryRole,
  RosterGenderBucket,
  RosterKind,
  RosterLine,
  RosterPosition,
  RosterStatus,
  SnapshotReason,
} from '../model/rosters.enums';
import type { RosterSnapshotRow } from '../model/rosters.rows';
import type { NewRosterSnapshot } from '../model/rosters.types';
import { RosterSnapshotRepository } from './roster-snapshot.repository';

const NOW = new Date('2026-03-01T10:00:00.000Z');

function row(overrides: Partial<RosterSnapshotRow> = {}): RosterSnapshotRow {
  return {
    id: 'snap-1',
    roster_id: 'roster-1',
    team_id: 'team-1',
    season_id: 'season-1',
    competition_id: 'comp-1',
    fixture_id: null,
    roster_kind: 'competition',
    revision: 1,
    reason: 'locked',
    roster_status: 'locked',
    entry_count: 1,
    checksum: 'abc',
    entries: [
      {
        membershipId: 'member-1',
        jerseyNumber: 7,
        entryRole: 'player',
        lineAssignment: 'any',
        fieldPosition: 'unspecified',
        genderBucket: 'men',
        availability: null,
        constraintOverridden: false,
      },
    ],
    taken_by: 'user-1',
    taken_at: NOW,
    ...overrides,
  };
}

function scopeReturning(...results: RosterSnapshotRow[][]): {
  scope: TransactionScope;
  run: ReturnType<typeof vi.fn>;
} {
  const run = vi.fn();
  for (const result of results) {
    run.mockResolvedValueOnce(result);
  }
  return { scope: { run }, run };
}

function newSnapshot(): NewRosterSnapshot {
  return {
    id: 'snap-1',
    rosterId: 'roster-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    competitionId: 'comp-1',
    fixtureId: null,
    rosterKind: RosterKind.Competition,
    revision: 1,
    reason: SnapshotReason.Locked,
    rosterStatus: RosterStatus.Locked,
    entryCount: 1,
    checksum: 'abc',
    entries: [
      {
        membershipId: 'member-1',
        jerseyNumber: 7,
        entryRole: RosterEntryRole.Player,
        lineAssignment: RosterLine.Any,
        fieldPosition: RosterPosition.Unspecified,
        genderBucket: RosterGenderBucket.Men,
        availability: null,
        constraintOverridden: false,
      },
    ],
    takenBy: 'user-1',
    now: NOW,
  };
}

describe('RosterSnapshotRepository', () => {
  const repository = new RosterSnapshotRepository();

  it('appends a snapshot with its entry payload serialized as jsonb', async () => {
    const { scope, run } = scopeReturning([row()]);
    const snapshot = await repository.append(scope, newSnapshot());
    expect(snapshot.snapshotId).toBe('snap-1');
    expect(snapshot.entries).toHaveLength(1);
    const statement = String(run.mock.calls[0]?.[0]);
    expect(statement).toContain('INSERT INTO "roster_snapshots"');
    expect(statement).toContain('$13::jsonb');
    expect((run.mock.calls[0]?.[1] as unknown[])[12]).toContain('member-1');
  });

  it('exposes no update or delete path at all', () => {
    const source = String(RosterSnapshotRepository.prototype.append);
    expect(source).not.toContain('UPDATE');
    expect(source).not.toContain('DELETE');
    expect(
      Object.getOwnPropertyNames(RosterSnapshotRepository.prototype).sort(),
    ).toEqual([
      'append',
      'appendParameters',
      'constructor',
      'countForRoster',
      'findByRevisionReason',
      'findLatest',
      'listForRoster',
      'requireRow',
    ]);
  });

  it('throws when the append returns no row', async () => {
    const { scope } = scopeReturning([]);
    await expect(repository.append(scope, newSnapshot())).rejects.toThrow(
      'Expected a returned row',
    );
  });

  it('finds an existing snapshot for a revision and reason, or null', async () => {
    const found = scopeReturning([row()]);
    expect(
      await repository.findByRevisionReason(
        found.scope,
        'roster-1',
        1,
        SnapshotReason.Locked,
      ),
    ).not.toBeNull();
    const missing = scopeReturning([]);
    expect(
      await repository.findByRevisionReason(
        missing.scope,
        'roster-1',
        2,
        SnapshotReason.Locked,
      ),
    ).toBeNull();
  });

  it('finds the newest snapshot of a roster, or null when it never froze', async () => {
    const found = scopeReturning([row()]);
    expect((await repository.findLatest(found.scope, 'roster-1'))?.reason).toBe(
      SnapshotReason.Locked,
    );
    expect(String(found.run.mock.calls[0]?.[0])).toContain(
      'ORDER BY "taken_at" DESC',
    );
    const missing = scopeReturning([]);
    expect(await repository.findLatest(missing.scope, 'roster-1')).toBeNull();
  });

  it('lists and counts a roster’s snapshots in a bounded window', async () => {
    const list = scopeReturning([row(), row({ id: 'snap-2' })]);
    expect(
      await repository.listForRoster(list.scope, 'roster-1', {
        limit: 9999,
        offset: 0,
      }),
    ).toHaveLength(2);
    expect((list.run.mock.calls[0]?.[1] as unknown[])[1]).toBe(200);
    const counted = { run: vi.fn().mockResolvedValue([{ count: 2 }]) };
    expect(
      await repository.countForRoster(
        counted as unknown as TransactionScope,
        'roster-1',
      ),
    ).toBe(2);
    const empty = { run: vi.fn().mockResolvedValue([]) };
    expect(
      await repository.countForRoster(
        empty as unknown as TransactionScope,
        'roster-1',
      ),
    ).toBe(0);
  });
});
