import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AssessmentVersionConflictError } from '../errors/assessment-version-conflict.error';
import { InvalidAssessmentTransitionError } from '../errors/invalid-assessment-transition.error';
import { PlayerAssessmentStatus } from '../model/player-assessments.enums';
import type { PlayerAssessment } from '../model/player-assessments.types';
import { PublishPlayerAssessmentUseCase } from './publish-player-assessment.use-case';

const SCOPE = {} as never;
const NOW = new Date('2026-06-01T00:00:00.000Z');
const ACTOR = { userId: 'p1', email: 'p@example.test', roles: [] } as never;

function approved(status = PlayerAssessmentStatus.Approved): PlayerAssessment {
  return {
    id: 'a1',
    familyId: 'a1',
    teamId: 't1',
    seasonId: null,
    periodId: 'p1',
    templateId: 'tm1',
    membershipId: 'm1',
    evaluatorUserId: 'e1',
    status,
    revision: 1,
    summary: null,
    recordVersion: 3,
    submittedAt: NOW,
    submittedBy: 'e1',
    reviewedAt: NOW,
    reviewedBy: 'r1',
    publishedAt: null,
    publishedBy: null,
    supersededAt: null,
    supersededById: null,
    createdBy: 'e1',
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function build() {
  const lookup = { requireForWrite: vi.fn().mockResolvedValue(approved()) };
  const repository = {
    applyTransition: vi
      .fn()
      .mockResolvedValue(approved(PlayerAssessmentStatus.Published)),
    findValues: vi.fn().mockResolvedValue([]),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const events = { enqueue: vi.fn().mockResolvedValue(undefined) };
  const unitOfWork = {
    runInTransaction: vi.fn((op: (s: never) => Promise<unknown>) => op(SCOPE)),
  };
  const clock = { now: vi.fn().mockReturnValue(NOW) };
  return {
    lookup,
    repository,
    audit,
    events,
    useCase: new PublishPlayerAssessmentUseCase(
      unitOfWork as never,
      clock as never,
      lookup as never,
      repository as never,
      audit as never,
      events as never,
    ),
  };
}

describe('PublishPlayerAssessmentUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('publishes an approved assessment, audits, and enqueues the event', async () => {
    const detail = await harness.useCase.execute(ACTOR, 't1', 'a1', {
      expectedRecordVersion: 3,
    });
    expect(detail.assessment.status).toBe(PlayerAssessmentStatus.Published);
    expect(harness.events.enqueue).toHaveBeenCalledTimes(1);
  });

  it('rejects publishing an assessment that is not approved', async () => {
    harness.lookup.requireForWrite.mockResolvedValueOnce(
      approved(PlayerAssessmentStatus.Submitted),
    );
    await expect(
      harness.useCase.execute(ACTOR, 't1', 'a1', { expectedRecordVersion: 3 }),
    ).rejects.toBeInstanceOf(InvalidAssessmentTransitionError);
    expect(harness.repository.applyTransition).not.toHaveBeenCalled();
  });

  it('surfaces an optimistic version conflict', async () => {
    harness.repository.applyTransition.mockResolvedValueOnce(null);
    await expect(
      harness.useCase.execute(ACTOR, 't1', 'a1', { expectedRecordVersion: 9 }),
    ).rejects.toBeInstanceOf(AssessmentVersionConflictError);
  });
});
