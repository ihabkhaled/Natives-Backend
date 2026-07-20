import type { AuthUserIdentity } from '@core/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FixtureInvalidTransitionError } from '../errors/fixture-invalid-transition.error';
import { FixtureScheduleError } from '../errors/fixture-schedule.error';
import { FixtureVersionConflictError } from '../errors/fixture-version-conflict.error';
import {
  FixtureStatus,
  FixtureTransition,
  MatchSide,
} from '../model/competitions.enums';
import type {
  Fixture,
  TransitionFixtureCommand,
} from '../model/competitions.types';
import { TransitionFixtureUseCase } from './transition-fixture.use-case';

const ACTOR: AuthUserIdentity = {
  userId: 'coach',
  email: 'c@x.test',
  roles: [],
};
const AT = new Date('2026-01-15T18:30:00.000Z');

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
    scheduledAt: AT,
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
    createdAt: AT,
    updatedAt: AT,
  };
}

function command(
  transition: FixtureTransition,
  reason: string | null = null,
): TransitionFixtureCommand {
  return { transition, expectedRecordVersion: 1, reason };
}

function build(status: FixtureStatus) {
  const tx = {} as never;
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(tx)),
  };
  const clock = { now: vi.fn().mockReturnValue(AT) };
  const lookup = {
    require: vi.fn().mockResolvedValue({ competitionId: 'comp-1' }),
  };
  const fixtures = { require: vi.fn().mockResolvedValue(fixture(status)) };
  const repository = { applyStatusChange: vi.fn() };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const events = { enqueue: vi.fn().mockResolvedValue(undefined) };
  const useCase = new TransitionFixtureUseCase(
    unitOfWork as never,
    clock as never,
    lookup as never,
    fixtures as never,
    repository as never,
    audit as never,
    events as never,
  );
  return { lookup, fixtures, repository, audit, events, useCase };
}

describe('TransitionFixtureUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build(FixtureStatus.Scheduled);
  });

  it('marks a scheduled fixture ready without emitting an event', async () => {
    harness.repository.applyStatusChange.mockResolvedValue(
      fixture(FixtureStatus.Ready),
    );
    const view = await harness.useCase.execute(
      ACTOR,
      'team-1',
      'comp-1',
      'fixture-1',
      command(FixtureTransition.Ready),
    );
    expect(view.status).toBe(FixtureStatus.Ready);
    expect(harness.events.enqueue).not.toHaveBeenCalled();
    expect(harness.audit.record).toHaveBeenCalledOnce();
  });

  it('rejects an invalid transition', async () => {
    await expect(
      harness.useCase.execute(
        ACTOR,
        'team-1',
        'comp-1',
        'fixture-1',
        command(FixtureTransition.Finalize),
      ),
    ).rejects.toBeInstanceOf(FixtureInvalidTransitionError);
    expect(harness.repository.applyStatusChange).not.toHaveBeenCalled();
  });

  it('requires a reason to cancel', async () => {
    await expect(
      harness.useCase.execute(
        ACTOR,
        'team-1',
        'comp-1',
        'fixture-1',
        command(FixtureTransition.Cancel),
      ),
    ).rejects.toBeInstanceOf(FixtureScheduleError);
  });

  it('cancels with a reason, keeps history, and emits the cancelled event', async () => {
    harness.repository.applyStatusChange.mockResolvedValue(
      fixture(FixtureStatus.Cancelled),
    );
    const view = await harness.useCase.execute(
      ACTOR,
      'team-1',
      'comp-1',
      'fixture-1',
      command(FixtureTransition.Cancel, 'forfeit'),
    );
    expect(view.status).toBe(FixtureStatus.Cancelled);
    expect(harness.events.enqueue).toHaveBeenCalledOnce();
  });

  it('raises a version conflict when the guarded update matches no row', async () => {
    harness.repository.applyStatusChange.mockResolvedValue(null);
    await expect(
      harness.useCase.execute(
        ACTOR,
        'team-1',
        'comp-1',
        'fixture-1',
        command(FixtureTransition.Ready),
      ),
    ).rejects.toBeInstanceOf(FixtureVersionConflictError);
  });
});
