import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import { FixtureStatus, MatchSide } from '../model/competitions.enums';
import type { FixtureRow } from '../model/competitions.rows';
import type {
  FixtureReschedule,
  FixtureStatusChange,
  NewFixture,
} from '../model/competitions.types';
import { FixtureRepository } from './fixture.repository';

const NOW = new Date('2026-03-01T12:00:00.000Z');
const LATER = new Date('2026-03-10T12:00:00.000Z');

function row(overrides: Partial<FixtureRow> = {}): FixtureRow {
  return {
    id: 'fixture-1',
    competition_id: 'comp-1',
    team_id: 'team-1',
    season_id: 'season-1',
    stage_id: null,
    round_id: null,
    opponent_id: 'opp-1',
    venue_id: 'venue-1',
    home_away: 'home',
    scheduled_at: NOW,
    status: 'scheduled',
    reschedule_count: 0,
    previous_scheduled_at: null,
    reschedule_reason: null,
    cancellation_reason: null,
    record_version: 1,
    created_by: 'user-1',
    rescheduled_at: null,
    finalized_at: null,
    cancelled_at: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function scope(rows: unknown[]): TransactionScope {
  return {
    run: vi.fn().mockResolvedValue(rows),
  };
}

function newFixture(): NewFixture {
  return {
    id: 'fixture-1',
    competitionId: 'comp-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    content: {
      opponentId: 'opp-1',
      stageId: null,
      roundId: null,
      venueId: 'venue-1',
      homeAway: MatchSide.Home,
      scheduledAt: NOW.toISOString(),
    },
    scheduledAt: NOW,
    createdBy: 'user-1',
    now: NOW,
  };
}

function reschedule(): FixtureReschedule {
  return {
    id: 'fixture-1',
    teamId: 'team-1',
    expectedRecordVersion: 1,
    newScheduledAt: LATER,
    previousScheduledAt: NOW,
    venueId: 'venue-1',
    reason: 'weather',
    now: NOW,
  };
}

function statusChange(): FixtureStatusChange {
  return {
    id: 'fixture-1',
    teamId: 'team-1',
    expectedRecordVersion: 1,
    toStatus: FixtureStatus.Cancelled,
    finalizedAt: null,
    cancelledAt: NOW,
    cancellationReason: 'forfeit',
    now: NOW,
  };
}

describe('FixtureRepository', () => {
  const repository = new FixtureRepository();

  it('inserts a fixture and maps the row', async () => {
    const created = await repository.insert(scope([row()]), newFixture());
    expect(created.fixtureId).toBe('fixture-1');
    expect(created.homeAway).toBe(MatchSide.Home);
  });

  it('throws when the insert returns no row', async () => {
    await expect(repository.insert(scope([]), newFixture())).rejects.toThrow(
      'Expected a returned row',
    );
  });

  it('finds a fixture for write or returns null', async () => {
    expect(
      await repository.findForWrite(scope([row()]), 'team-1', 'comp-1', 'f'),
    ).not.toBeNull();
    expect(
      await repository.findForWrite(scope([]), 'team-1', 'comp-1', 'f'),
    ).toBeNull();
  });

  it('applies a reschedule or returns null on a version miss', async () => {
    const applied = await repository.applyReschedule(
      scope([row({ status: 'rescheduled', reschedule_count: 1 })]),
      reschedule(),
    );
    expect(applied?.status).toBe(FixtureStatus.Rescheduled);
    expect(
      await repository.applyReschedule(scope([]), reschedule()),
    ).toBeNull();
  });

  it('applies a status change or returns null on a version miss', async () => {
    const applied = await repository.applyStatusChange(
      scope([row({ status: 'cancelled', cancelled_at: NOW })]),
      statusChange(),
    );
    expect(applied?.status).toBe(FixtureStatus.Cancelled);
    expect(
      await repository.applyStatusChange(scope([]), statusChange()),
    ).toBeNull();
  });

  it('lists and counts fixtures for a competition', async () => {
    const items = await repository.listForCompetition(
      scope([row(), row({ id: 'fixture-2' })]),
      'team-1',
      'comp-1',
      { limit: 20, offset: 0 },
    );
    expect(items).toHaveLength(2);
    expect(
      await repository.countForCompetition(
        scope([{ count: 2 }]),
        'team-1',
        'comp-1',
      ),
    ).toBe(2);
    expect(
      await repository.countForCompetition(scope([]), 'team-1', 'comp-1'),
    ).toBe(0);
  });
});
