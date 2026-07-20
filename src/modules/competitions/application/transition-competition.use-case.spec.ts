import type { AuthUserIdentity } from '@core/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CompetitionInvalidTransitionError } from '../errors/competition-invalid-transition.error';
import { CompetitionValidationError } from '../errors/competition-validation.error';
import { CompetitionVersionConflictError } from '../errors/competition-version-conflict.error';
import {
  CompetitionStatus,
  CompetitionTransition,
} from '../model/competitions.enums';
import type {
  Competition,
  TransitionCompetitionCommand,
} from '../model/competitions.types';
import { TransitionCompetitionUseCase } from './transition-competition.use-case';

const ACTOR: AuthUserIdentity = {
  userId: 'coach',
  email: 'c@x.test',
  roles: [],
};

function competition(status: CompetitionStatus): Competition {
  return {
    competitionId: 'comp-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    name: 'Cairo League',
    competitionType: 'league' as never,
    status,
    genderDivision: null,
    organizerName: null,
    externalRef: null,
    startsOn: null,
    endsOn: null,
    description: null,
    cancellationReason: null,
    recordVersion: 1,
    createdBy: 'coach',
    publishedBy: null,
    publishedAt: null,
    activatedAt: null,
    completedAt: null,
    cancelledAt: null,
    archivedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };
}

function command(
  transition: CompetitionTransition,
  reason: string | null = null,
): TransitionCompetitionCommand {
  return { transition, expectedRecordVersion: 1, reason };
}

function build(existingStatus: CompetitionStatus) {
  const tx = {} as never;
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(tx)),
  };
  const clock = {
    now: vi.fn().mockReturnValue(new Date('2026-02-01T00:00:00Z')),
  };
  const lookup = {
    require: vi.fn().mockResolvedValue(competition(existingStatus)),
  };
  const repository = { applyStatusChange: vi.fn() };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const events = { enqueue: vi.fn().mockResolvedValue(undefined) };
  const useCase = new TransitionCompetitionUseCase(
    unitOfWork as never,
    clock as never,
    lookup as never,
    repository as never,
    audit as never,
    events as never,
  );
  return { lookup, repository, audit, events, useCase };
}

describe('TransitionCompetitionUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build(CompetitionStatus.Draft);
  });

  it('publishes a draft and emits the published event', async () => {
    harness.repository.applyStatusChange.mockResolvedValue(
      competition(CompetitionStatus.Published),
    );
    const result = await harness.useCase.execute(
      ACTOR,
      'team-1',
      'comp-1',
      command(CompetitionTransition.Publish),
    );
    expect(result.status).toBe(CompetitionStatus.Published);
    expect(harness.events.enqueue).toHaveBeenCalledOnce();
    expect(harness.audit.record).toHaveBeenCalledOnce();
  });

  it('rejects an invalid transition without writing', async () => {
    await expect(
      harness.useCase.execute(
        ACTOR,
        'team-1',
        'comp-1',
        command(CompetitionTransition.Complete),
      ),
    ).rejects.toBeInstanceOf(CompetitionInvalidTransitionError);
    expect(harness.repository.applyStatusChange).not.toHaveBeenCalled();
  });

  it('requires a reason to cancel', async () => {
    await expect(
      harness.useCase.execute(
        ACTOR,
        'team-1',
        'comp-1',
        command(CompetitionTransition.Cancel),
      ),
    ).rejects.toBeInstanceOf(CompetitionValidationError);
  });

  it('cancels with a reason and emits the cancelled event', async () => {
    harness.repository.applyStatusChange.mockResolvedValue(
      competition(CompetitionStatus.Cancelled),
    );
    await harness.useCase.execute(
      ACTOR,
      'team-1',
      'comp-1',
      command(CompetitionTransition.Cancel, 'venue lost'),
    );
    expect(harness.events.enqueue).toHaveBeenCalledOnce();
  });

  it('raises a version conflict when the guarded update matches no row', async () => {
    harness.repository.applyStatusChange.mockResolvedValue(null);
    await expect(
      harness.useCase.execute(
        ACTOR,
        'team-1',
        'comp-1',
        command(CompetitionTransition.Publish),
      ),
    ).rejects.toBeInstanceOf(CompetitionVersionConflictError);
  });

  it('does not emit an event for a non-published, non-cancelled transition', async () => {
    const activate = build(CompetitionStatus.Published);
    activate.repository.applyStatusChange.mockResolvedValue(
      competition(CompetitionStatus.Active),
    );
    await activate.useCase.execute(
      ACTOR,
      'team-1',
      'comp-1',
      command(CompetitionTransition.Activate),
    );
    expect(activate.events.enqueue).not.toHaveBeenCalled();
  });
});
