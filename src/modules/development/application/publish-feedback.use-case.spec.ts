import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FeedbackInvalidTransitionError } from '../errors/feedback-invalid-transition.error';
import { FeedbackVersionConflictError } from '../errors/feedback-version-conflict.error';
import { FeedbackStatus } from '../model/feedback.enums';
import type { CoachFeedback } from '../model/feedback.types';
import { PublishFeedbackUseCase } from './publish-feedback.use-case';

const NOW = new Date('2026-03-01T00:00:00.000Z');
const actor = { userId: 'coach-1' } as never;

function feedback(status: FeedbackStatus): CoachFeedback {
  return {
    id: 'fb-1',
    familyId: 'fb-1',
    teamId: 'team-1',
    seasonId: null,
    membershipId: 'mem-1',
    authorUserId: 'coach-1',
    status,
    revision: 1,
    recordVersion: 1,
    positiveFrisbee: null,
    frisbeeImprovement: null,
    positiveMental: null,
    mentalImprovement: null,
    teamRole: null,
    recommendedPosition: null,
    summary: null,
    coachNote: 'secret',
    submittedAt: NOW,
    submittedBy: 'coach-1',
    publishedAt: NOW,
    publishedBy: 'coach-1',
    supersededAt: null,
    supersededById: null,
    createdBy: 'coach-1',
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function build(current: CoachFeedback) {
  const tx = {} as never;
  const unitOfWork = {
    runInTransaction: vi.fn((cb: (t: never) => unknown) => cb(tx)),
  };
  const clock = { now: vi.fn(() => NOW) };
  const lookup = { requireForWrite: vi.fn(() => current) };
  const repository = {
    applyTransition: vi.fn(() => feedback(FeedbackStatus.Published)),
  };
  const audit = { record: vi.fn() };
  const events = { enqueue: vi.fn() };
  const useCase = new PublishFeedbackUseCase(
    unitOfWork as never,
    clock as never,
    lookup as never,
    repository as never,
    audit as never,
    events as never,
  );
  return { repository, audit, events, useCase };
}

function run(harness: ReturnType<typeof build>) {
  return harness.useCase.execute(actor, 'team-1', 'fb-1', {
    expectedRecordVersion: 1,
  });
}

describe('PublishFeedbackUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build(feedback(FeedbackStatus.InReview));
  });

  it('publishes an in-review record and enqueues a privacy-safe event', async () => {
    const detail = await run(harness);
    expect(detail.feedback.status).toBe(FeedbackStatus.Published);
    expect(harness.audit.record).toHaveBeenCalled();
    const event = harness.events.enqueue.mock.calls[0]?.[1];
    expect(JSON.stringify(event)).not.toContain('secret');
  });

  it('rejects publishing a non-in-review record', async () => {
    harness = build(feedback(FeedbackStatus.Draft));
    await expect(run(harness)).rejects.toBeInstanceOf(
      FeedbackInvalidTransitionError,
    );
  });

  it('surfaces a version conflict', async () => {
    harness = build(feedback(FeedbackStatus.InReview));
    harness.repository.applyTransition.mockReturnValue(null as never);
    await expect(run(harness)).rejects.toBeInstanceOf(
      FeedbackVersionConflictError,
    );
  });
});
