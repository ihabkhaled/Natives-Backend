import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionStatus, SessionVisibility } from '../model/practices.enums';
import type { SessionRow } from '../model/practices.rows';
import type { NewSession, SessionListFilter } from '../model/practices.types';
import { PracticeSessionRepository } from './practice-session.repository';

const NOW = new Date('2026-07-18T10:00:00.000Z');

const ROW: SessionRow = {
  id: 'session-1',
  team_id: 'team-1',
  season_id: null,
  schedule_id: 'schedule-1',
  occurrence_date: '2026-07-21',
  session_type: 'practice',
  timezone: 'Africa/Cairo',
  venue_id: null,
  field: null,
  capacity: null,
  meet_at: null,
  starts_at: '2026-07-21T15:00:00.000Z',
  ends_at: '2026-07-21T17:00:00.000Z',
  rsvp_cutoff_at: null,
  visibility: 'team',
  organizer_user_id: null,
  notes: null,
  status: 'published',
  cancellation_reason: null,
  created_by: 'admin-1',
  updated_by: null,
  created_at: NOW,
  updated_at: NOW,
  version: 1,
};

const NEW_SESSION: NewSession = {
  id: 'session-1',
  teamId: 'team-1',
  seasonId: null,
  scheduleId: 'schedule-1',
  occurrenceDate: '2026-07-21',
  sessionType: 'practice',
  timezone: 'Africa/Cairo',
  venueId: null,
  field: null,
  capacity: null,
  meetAt: null,
  startsAt: new Date('2026-07-21T15:00:00.000Z'),
  endsAt: new Date('2026-07-21T17:00:00.000Z'),
  rsvpCutoffAt: null,
  visibility: SessionVisibility.Team,
  organizerUserId: null,
  notes: null,
  status: SessionStatus.Published,
  createdBy: 'admin-1',
  now: NOW,
};

function filter(overrides: Partial<SessionListFilter>): SessionListFilter {
  return {
    from: null,
    to: null,
    status: null,
    sessionType: null,
    seasonId: null,
    scheduleId: null,
    limit: 20,
    offset: 0,
    ...overrides,
  };
}

function scope() {
  return { run: vi.fn() };
}

describe('PracticeSessionRepository', () => {
  let repository: PracticeSessionRepository;
  let transaction: ReturnType<typeof scope>;

  beforeEach(() => {
    repository = new PracticeSessionRepository();
    transaction = scope();
  });

  it('filters the list and count by schedule with one bound parameter', async () => {
    transaction.run
      .mockResolvedValueOnce([ROW])
      .mockResolvedValueOnce([{ count: 1 }]);
    const result = await repository.list(
      transaction as never,
      'team-1',
      filter({ scheduleId: 'schedule-1' }),
    );
    const [listSql, listParams] = transaction.run.mock.calls[0] as [
      string,
      readonly unknown[],
    ];
    const [countSql, countParams] = transaction.run.mock.calls[1] as [
      string,
      readonly unknown[],
    ];
    expect(listSql).toContain('"schedule_id" = $2');
    expect(listParams).toEqual(['team-1', 'schedule-1', 20, 0]);
    expect(countSql).toContain('"schedule_id" = $2');
    expect(countParams).toEqual(['team-1', 'schedule-1']);
    expect(result.items[0]?.scheduleId).toBe('schedule-1');
    expect(result.total).toBe(1);
  });

  it('leaves an absent schedule dimension unfiltered (null passthrough)', async () => {
    transaction.run
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: 0 }]);
    await repository.list(transaction as never, 'team-1', filter({}));
    const [listSql, listParams] = transaction.run.mock.calls[0] as [
      string,
      readonly unknown[],
    ];
    expect(listSql).not.toContain('"schedule_id" =');
    expect(listParams).toEqual(['team-1', 20, 0]);
  });

  it('composes every dimension in declaration order after the team scope', async () => {
    transaction.run
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: 0 }]);
    await repository.list(
      transaction as never,
      'team-1',
      filter({
        from: new Date('2026-01-01T00:00:00.000Z'),
        to: new Date('2026-12-31T00:00:00.000Z'),
        status: SessionStatus.Published,
        sessionType: 'practice',
        seasonId: 'season-1',
        scheduleId: 'schedule-1',
      }),
    );
    const [sql, params] = transaction.run.mock.calls[0] as [
      string,
      readonly unknown[],
    ];
    expect(sql).toContain('"schedule_id" = $7');
    expect(params).toEqual([
      'team-1',
      '2026-01-01T00:00:00.000Z',
      '2026-12-31T00:00:00.000Z',
      'published',
      'practice',
      'season-1',
      'schedule-1',
      20,
      0,
    ]);
  });

  it('guards generated inserts with the (schedule, occurrence-date) conflict skip', async () => {
    transaction.run.mockResolvedValue([]);
    const inserted = await repository.insertGenerated(
      transaction as never,
      NEW_SESSION,
    );
    const [sql] = transaction.run.mock.calls[0] as [string];
    expect(sql).toContain(
      'ON CONFLICT ("schedule_id", "occurrence_date") ' +
        'WHERE "schedule_id" IS NOT NULL DO NOTHING',
    );
    // Conflict ⇒ no RETURNING row ⇒ null: the caller counts it as skipped and
    // the existing stable occurrence is never rewritten.
    expect(inserted).toBeNull();
  });

  it('returns the inserted occurrence when no conflict occurs', async () => {
    transaction.run.mockResolvedValue([ROW]);
    await expect(
      repository.insertGenerated(transaction as never, NEW_SESSION),
    ).resolves.toMatchObject({
      id: 'session-1',
      scheduleId: 'schedule-1',
      occurrenceDate: '2026-07-21',
    });
  });

  it('keeps one-off inserts conflict-free and fails loudly on a lost row', async () => {
    transaction.run.mockResolvedValue([ROW]);
    await repository.insert(transaction as never, NEW_SESSION);
    const [sql] = transaction.run.mock.calls[0] as [string];
    expect(sql).not.toContain('ON CONFLICT');
    transaction.run.mockResolvedValue([]);
    await expect(
      repository.insert(transaction as never, NEW_SESSION),
    ).rejects.toThrow('Expected a returned row from the session write');
  });
});
