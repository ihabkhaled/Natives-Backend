import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import {
  RosterDivision,
  RosterKind,
  RosterStatus,
} from '../model/rosters.enums';
import type { RosterRow } from '../model/rosters.rows';
import type { NewRoster, RosterStatusChange } from '../model/rosters.types';
import { RosterRepository } from './roster.repository';

const NOW = new Date('2026-03-01T10:00:00.000Z');

function row(overrides: Partial<RosterRow> = {}): RosterRow {
  return {
    id: 'roster-1',
    team_id: 'team-1',
    season_id: 'season-1',
    competition_id: 'comp-1',
    fixture_id: null,
    squad_id: null,
    source_roster_id: null,
    supersedes_roster_id: null,
    current_snapshot_id: null,
    roster_kind: 'competition',
    name: 'Nationals Roster',
    status: 'draft',
    division: 'mixed',
    min_size: 7,
    max_size: 30,
    min_women: null,
    require_captain: true,
    policy_version: 'roster-constraints-v1',
    selection_deadline: null,
    notes: null,
    revision: 1,
    record_version: 1,
    created_by: 'user-1',
    published_by: null,
    published_at: null,
    locked_by: null,
    locked_at: null,
    revised_by: null,
    revised_at: null,
    revision_reason: null,
    archived_at: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function scopeReturning(...results: RosterRow[][]): {
  scope: TransactionScope;
  run: ReturnType<typeof vi.fn>;
} {
  const run = vi.fn();
  for (const result of results) {
    run.mockResolvedValueOnce(result);
  }
  return { scope: { run }, run };
}

function newRoster(): NewRoster {
  return {
    id: 'roster-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    competitionId: 'comp-1',
    fixtureId: null,
    squadId: 'squad-1',
    sourceRosterId: null,
    supersedesRosterId: null,
    rosterKind: RosterKind.Competition,
    name: 'Nationals Roster',
    division: RosterDivision.Mixed,
    minSize: 7,
    maxSize: 30,
    minWomen: null,
    requireCaptain: true,
    policyVersion: 'roster-constraints-v1',
    selectionDeadline: null,
    notes: null,
    revision: 1,
    createdBy: 'user-1',
    now: NOW,
  };
}

function statusChange(
  overrides: Partial<RosterStatusChange> = {},
): RosterStatusChange {
  return {
    id: 'roster-1',
    teamId: 'team-1',
    expectedRecordVersion: 1,
    toStatus: RosterStatus.Published,
    publishedBy: 'user-1',
    publishedAt: NOW,
    lockedBy: null,
    lockedAt: null,
    revisedBy: null,
    revisedAt: null,
    revisionReason: null,
    archivedAt: null,
    now: NOW,
    ...overrides,
  };
}

describe('RosterRepository', () => {
  const repository = new RosterRepository();

  it('inserts a roster and returns the mapped aggregate', async () => {
    const { scope, run } = scopeReturning([row()]);
    const created = await repository.insert(scope, newRoster());
    expect(created.rosterId).toBe('roster-1');
    expect(String(run.mock.calls[0]?.[0])).toContain('INSERT INTO "rosters"');
    expect(run.mock.calls[0]?.[1]).toHaveLength(21);
  });

  it('throws when the insert returns no row', async () => {
    const { scope } = scopeReturning([]);
    await expect(repository.insert(scope, newRoster())).rejects.toThrow(
      'Expected a returned row',
    );
  });

  it('finds a roster for write or returns null for a foreign team', async () => {
    const present = scopeReturning([row()]);
    expect(
      await repository.findForWrite(present.scope, 'team-1', 'roster-1'),
    ).not.toBeNull();
    const absent = scopeReturning([]);
    expect(
      await repository.findForWrite(absent.scope, 'other-team', 'roster-1'),
    ).toBeNull();
  });

  it('applies a status change or returns null on a version miss', async () => {
    const applied = scopeReturning([row({ status: 'published' })]);
    expect(
      (await repository.applyStatusChange(applied.scope, statusChange()))
        ?.status,
    ).toBe(RosterStatus.Published);
    const missed = scopeReturning([]);
    expect(
      await repository.applyStatusChange(missed.scope, statusChange()),
    ).toBeNull();
  });

  it('serializes every stamped instant, keeping nulls null', async () => {
    const { scope, run } = scopeReturning([row({ status: 'revised' })]);
    await repository.applyStatusChange(
      scope,
      statusChange({
        toStatus: RosterStatus.Revised,
        publishedAt: null,
        revisedAt: NOW,
        revisionReason: 'injury replacement',
      }),
    );
    const parameters = run.mock.calls[0]?.[1] as unknown[];
    expect(parameters[5]).toBeNull();
    expect(parameters[9]).toBe(NOW.toISOString());
    expect(parameters[10]).toBe('injury replacement');
  });

  it('moves only the snapshot pointer, never the snapshot itself', async () => {
    const run = vi.fn().mockResolvedValue([]);
    await repository.attachSnapshot({ run }, 'roster-1', 'snap-1', NOW);
    const statement = String(run.mock.calls[0]?.[0]);
    expect(statement).toContain('UPDATE "rosters"');
    expect(statement).toContain('"current_snapshot_id" = $2');
    expect(statement).not.toContain('roster_snapshots');
  });

  it('lists and counts rosters under the allow-listed filter', async () => {
    const list = scopeReturning([row(), row({ id: 'roster-2' })]);
    const items = await repository.listForScope(
      list.scope,
      'team-1',
      { competitionId: 'comp-1', fixtureId: null, rosterKind: null },
      { limit: 500, offset: 0 },
    );
    expect(items).toHaveLength(2);
    expect((list.run.mock.calls[0]?.[1] as unknown[])[4]).toBe(100);
    const count = { run: vi.fn().mockResolvedValue([{ count: 2 }]) };
    expect(
      await repository.countForScope(
        count as unknown as TransactionScope,
        'team-1',
        {
          competitionId: null,
          fixtureId: 'fixture-1',
          rosterKind: RosterKind.Match,
        },
      ),
    ).toBe(2);
    const empty = { run: vi.fn().mockResolvedValue([]) };
    expect(
      await repository.countForScope(
        empty as unknown as TransactionScope,
        'team-1',
        { competitionId: null, fixtureId: null, rosterKind: null },
      ),
    ).toBe(0);
  });
});
