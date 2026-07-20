import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import { SquadStatus } from '../model/squads.enums';
import type { SquadRow } from '../model/squads.rows';
import type { NewSquad, SquadStatusChange } from '../model/squads.types';
import { SquadRepository } from './squad.repository';

const NOW = new Date('2026-02-01T12:00:00.000Z');

function row(overrides: Partial<SquadRow> = {}): SquadRow {
  return {
    id: 'squad-1',
    team_id: 'team-1',
    season_id: 'season-1',
    competition_id: null,
    name: 'Nationals Squad',
    status: 'draft',
    attendance_threshold_pct: '70.00',
    policy_version: 'eligibility-signals-v1',
    selection_deadline: null,
    notes: null,
    revision: 1,
    record_version: 1,
    created_by: 'user-1',
    published_by: null,
    published_at: null,
    locked_at: null,
    archived_at: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function scopeReturning(...results: SquadRow[][]): {
  scope: TransactionScope;
  run: ReturnType<typeof vi.fn>;
} {
  const run = vi.fn();
  for (const result of results) {
    run.mockResolvedValueOnce(result);
  }
  return { scope: { run }, run };
}

function newSquad(): NewSquad {
  return {
    id: 'squad-1',
    teamId: 'team-1',
    content: {
      name: 'Nationals Squad',
      seasonId: 'season-1',
      competitionId: null,
      attendanceThresholdPct: 70,
      selectionDeadline: null,
      notes: null,
    },
    policyVersion: 'eligibility-signals-v1',
    createdBy: 'user-1',
    now: NOW,
  };
}

function statusChange(): SquadStatusChange {
  return {
    id: 'squad-1',
    teamId: 'team-1',
    expectedRecordVersion: 1,
    toStatus: SquadStatus.Published,
    bumpRevision: false,
    publishedBy: 'user-1',
    publishedAt: NOW,
    lockedAt: null,
    archivedAt: null,
    now: NOW,
  };
}

describe('SquadRepository', () => {
  const repository = new SquadRepository();

  it('inserts a squad and returns the mapped aggregate', async () => {
    const { scope, run } = scopeReturning([row()]);
    const created = await repository.insert(scope, newSquad());
    expect(created.squadId).toBe('squad-1');
    expect(created.attendanceThresholdPct).toBe(70);
    expect(String(run.mock.calls[0]?.[0])).toContain('INSERT INTO "squads"');
  });

  it('throws when the insert returns no row', async () => {
    const { scope } = scopeReturning([]);
    await expect(repository.insert(scope, newSquad())).rejects.toThrow(
      'Expected a returned row',
    );
  });

  it('finds a squad for write or returns null', async () => {
    const present = scopeReturning([row()]);
    expect(
      await repository.findForWrite(present.scope, 'team-1', 'squad-1'),
    ).not.toBeNull();
    const absent = scopeReturning([]);
    expect(
      await repository.findForWrite(absent.scope, 'team-1', 'squad-1'),
    ).toBeNull();
  });

  it('applies a status change or returns null on a version miss', async () => {
    const applied = scopeReturning([row({ status: 'published' })]);
    const changed = await repository.applyStatusChange(
      applied.scope,
      statusChange(),
    );
    expect(changed?.status).toBe(SquadStatus.Published);
    const missed = scopeReturning([]);
    expect(
      await repository.applyStatusChange(missed.scope, statusChange()),
    ).toBeNull();
  });

  it('lists and counts squads in a bounded scope', async () => {
    const list = scopeReturning([row(), row({ id: 'squad-2' })]);
    const items = await repository.listForScope(list.scope, 'team-1', null, {
      limit: 20,
      offset: 0,
    });
    expect(items).toHaveLength(2);
    const count = { run: vi.fn().mockResolvedValue([{ count: 2 }]) };
    expect(
      await repository.countForScope(
        count as unknown as TransactionScope,
        'team-1',
        'season-1',
      ),
    ).toBe(2);
    const empty = { run: vi.fn().mockResolvedValue([]) };
    expect(
      await repository.countForScope(
        empty as unknown as TransactionScope,
        'team-1',
        null,
      ),
    ).toBe(0);
  });
});
