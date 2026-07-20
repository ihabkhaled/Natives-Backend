import type { AuthUserIdentity } from '@core/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FixtureInvalidTransitionError } from '../errors/fixture-invalid-transition.error';
import { FixtureScheduleError } from '../errors/fixture-schedule.error';
import { FixtureVersionConflictError } from '../errors/fixture-version-conflict.error';
import { FixtureStatus, MatchSide } from '../model/competitions.enums';
import type {
  Competition,
  Fixture,
  RescheduleFixtureCommand,
} from '../model/competitions.types';
import { RescheduleFixtureUseCase } from './reschedule-fixture.use-case';

const ACTOR: AuthUserIdentity = {
  userId: 'coach',
  email: 'c@x.test',
  roles: [],
};
const SCHEDULED_AT = new Date('2026-01-15T18:30:00.000Z');

function competition(): Competition {
  return {
    competitionId: 'comp-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    name: 'Cairo League',
    competitionType: 'league' as never,
    status: 'active' as never,
    genderDivision: null,
    organizerName: null,
    externalRef: null,
    startsOn: '2026-01-01',
    endsOn: '2026-03-01',
    description: null,
    cancellationReason: null,
    recordVersion: 1,
    createdBy: 'coach',
    publishedBy: 'coach',
    publishedAt: null,
    activatedAt: null,
    completedAt: null,
    cancelledAt: null,
    archivedAt: null,
    createdAt: SCHEDULED_AT,
    updatedAt: SCHEDULED_AT,
  };
}

function fixture(status: FixtureStatus): Fixture {
  return {
    fixtureId: 'fixture-1',
    competitionId: 'comp-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    stageId: null,
    roundId: null,
    opponentId: 'opp-1',
    venueId: 'venue-1',
    homeAway: MatchSide.Home,
    scheduledAt: SCHEDULED_AT,
    status,
    rescheduleCount: 0,
    previousScheduledAt: null,
    rescheduleReason: null,
    cancellationReason: null,
    recordVersion: 1,
    createdBy: 'coach',
    rescheduledAt: null,
    finalizedAt: null,
    cancelledAt: null,
    createdAt: SCHEDULED_AT,
    updatedAt: SCHEDULED_AT,
  };
}

function command(
  scheduledAt = '2026-01-20T18:30:00.000Z',
): RescheduleFixtureCommand {
  return {
    scheduledAt,
    venueId: null,
    reason: 'weather',
    expectedRecordVersion: 1,
  };
}

function build(status: FixtureStatus) {
  const tx = {} as never;
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(tx)),
  };
  const clock = { now: vi.fn().mockReturnValue(SCHEDULED_AT) };
  const lookup = { require: vi.fn().mockResolvedValue(competition()) };
  const scope = { requireVenue: vi.fn().mockResolvedValue(undefined) };
  const repository = {
    applyReschedule: vi
      .fn()
      .mockResolvedValue(fixture(FixtureStatus.Rescheduled)),
  };
  const fixtures = { require: vi.fn().mockResolvedValue(fixture(status)) };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const events = { enqueue: vi.fn().mockResolvedValue(undefined) };
  const useCase = new RescheduleFixtureUseCase(
    unitOfWork as never,
    clock as never,
    lookup as never,
    scope as never,
    repository as never,
    fixtures as never,
    audit as never,
    events as never,
  );
  return { lookup, scope, repository, fixtures, audit, events, useCase };
}

describe('RescheduleFixtureUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build(FixtureStatus.Scheduled);
  });

  it('moves the fixture, audits, and emits the rescheduled event', async () => {
    const view = await harness.useCase.execute(
      ACTOR,
      'team-1',
      'comp-1',
      'fixture-1',
      command(),
    );
    expect(view.status).toBe(FixtureStatus.Rescheduled);
    expect(harness.events.enqueue).toHaveBeenCalledOnce();
    expect(harness.audit.record).toHaveBeenCalledOnce();
  });

  it('rejects rescheduling a fixture that has started', async () => {
    const live = build(FixtureStatus.Live);
    await expect(
      live.useCase.execute(ACTOR, 'team-1', 'comp-1', 'fixture-1', command()),
    ).rejects.toBeInstanceOf(FixtureInvalidTransitionError);
    expect(live.repository.applyReschedule).not.toHaveBeenCalled();
  });

  it('rejects a reschedule that does not move the instant', async () => {
    await expect(
      harness.useCase.execute(
        ACTOR,
        'team-1',
        'comp-1',
        'fixture-1',
        command(SCHEDULED_AT.toISOString()),
      ),
    ).rejects.toBeInstanceOf(FixtureScheduleError);
  });

  it('rejects a move outside the competition window', async () => {
    await expect(
      harness.useCase.execute(
        ACTOR,
        'team-1',
        'comp-1',
        'fixture-1',
        command('2026-04-01T18:30:00.000Z'),
      ),
    ).rejects.toBeInstanceOf(FixtureScheduleError);
  });

  it('raises a version conflict when the guarded update matches no row', async () => {
    harness.repository.applyReschedule.mockResolvedValue(null);
    await expect(
      harness.useCase.execute(
        ACTOR,
        'team-1',
        'comp-1',
        'fixture-1',
        command(),
      ),
    ).rejects.toBeInstanceOf(FixtureVersionConflictError);
  });
});
