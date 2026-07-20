import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import {
  CompetitionStatus,
  CompetitionType,
} from '../model/competitions.enums';
import type { CompetitionRow } from '../model/competitions.rows';
import type {
  CompetitionStatusChange,
  NewCompetition,
} from '../model/competitions.types';
import { CompetitionRepository } from './competition.repository';

const NOW = new Date('2026-03-01T12:00:00.000Z');

function row(overrides: Partial<CompetitionRow> = {}): CompetitionRow {
  return {
    id: 'comp-1',
    team_id: 'team-1',
    season_id: 'season-1',
    name: 'Cairo League',
    competition_type: 'league',
    status: 'draft',
    gender_division: null,
    organizer_name: null,
    external_ref: null,
    starts_on: null,
    ends_on: null,
    description: null,
    cancellation_reason: null,
    record_version: 1,
    created_by: 'user-1',
    published_by: null,
    published_at: null,
    activated_at: null,
    completed_at: null,
    cancelled_at: null,
    archived_at: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function scopeReturning(...results: CompetitionRow[][]): {
  scope: TransactionScope;
  run: ReturnType<typeof vi.fn>;
} {
  const run = vi.fn();
  for (const result of results) {
    run.mockResolvedValueOnce(result);
  }
  return { scope: { run }, run };
}

function newCompetition(): NewCompetition {
  return {
    id: 'comp-1',
    teamId: 'team-1',
    content: {
      name: 'Cairo League',
      competitionType: CompetitionType.League,
      seasonId: 'season-1',
      genderDivision: null,
      organizerName: null,
      externalRef: null,
      startsOn: null,
      endsOn: null,
      description: null,
    },
    createdBy: 'user-1',
    now: NOW,
  };
}

function statusChange(): CompetitionStatusChange {
  return {
    id: 'comp-1',
    teamId: 'team-1',
    expectedRecordVersion: 1,
    toStatus: CompetitionStatus.Published,
    publishedBy: 'user-1',
    publishedAt: NOW,
    activatedAt: null,
    completedAt: null,
    cancelledAt: null,
    archivedAt: null,
    cancellationReason: null,
    now: NOW,
  };
}

describe('CompetitionRepository', () => {
  const repository = new CompetitionRepository();

  it('inserts a competition and returns the mapped aggregate', async () => {
    const { scope, run } = scopeReturning([row()]);
    const created = await repository.insert(scope, newCompetition());
    expect(created.competitionId).toBe('comp-1');
    expect(String(run.mock.calls[0]?.[0])).toContain(
      'INSERT INTO "competitions"',
    );
  });

  it('throws when the insert returns no row', async () => {
    const { scope } = scopeReturning([]);
    await expect(repository.insert(scope, newCompetition())).rejects.toThrow(
      'Expected a returned row',
    );
  });

  it('finds a competition for write or returns null', async () => {
    const present = scopeReturning([row()]);
    expect(
      await repository.findForWrite(present.scope, 'team-1', 'comp-1'),
    ).not.toBeNull();
    const absent = scopeReturning([]);
    expect(
      await repository.findForWrite(absent.scope, 'team-1', 'comp-1'),
    ).toBeNull();
  });

  it('applies a status change or returns null on a version miss', async () => {
    const applied = scopeReturning([row({ status: 'published' })]);
    const changed = await repository.applyStatusChange(
      applied.scope,
      statusChange(),
    );
    expect(changed?.status).toBe(CompetitionStatus.Published);
    const missed = scopeReturning([]);
    expect(
      await repository.applyStatusChange(missed.scope, statusChange()),
    ).toBeNull();
  });

  it('lists and counts competitions in a bounded scope', async () => {
    const list = scopeReturning([row(), row({ id: 'comp-2' })]);
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
