import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FeedbackInvalidTransitionError } from '../errors/feedback-invalid-transition.error';
import { FeedbackStatus } from '../model/feedback.enums';
import type { CoachFeedback } from '../model/feedback.types';
import { CorrectFeedbackUseCase } from './correct-feedback.use-case';

const NOW = new Date('2026-03-01T00:00:00.000Z');
const actor = { userId: 'admin-1' } as never;

function feedback(
  status: FeedbackStatus,
  supersededAt: Date | null = null,
): CoachFeedback {
  return {
    id: 'fb-1',
    familyId: 'fam-1',
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
    supersededAt,
    supersededById: null,
    createdBy: 'coach-1',
    createdAt: NOW,
    updatedAt: NOW,
  };
}

const FIELDS = {
  positiveFrisbee: null,
  frisbeeImprovement: null,
  positiveMental: null,
  mentalImprovement: null,
  teamRole: null,
  recommendedPosition: null,
  summary: 'corrected',
  coachNote: 'secret2',
};

function build(current: CoachFeedback, superseded = true) {
  const tx = {} as never;
  const unitOfWork = {
    runInTransaction: vi.fn((cb: (t: never) => unknown) => cb(tx)),
  };
  const clock = { now: vi.fn(() => NOW) };
  const idGenerator = { generate: vi.fn(() => 'fb-2') };
  const lookup = { requireForWrite: vi.fn(() => current) };
  const repository = {
    supersede: vi.fn(() => superseded),
    insertFeedback: vi.fn(() => feedback(FeedbackStatus.Revised)),
  };
  const audit = { record: vi.fn() };
  const events = { enqueue: vi.fn() };
  const useCase = new CorrectFeedbackUseCase(
    unitOfWork as never,
    clock as never,
    idGenerator,
    lookup as never,
    repository as never,
    audit as never,
    events as never,
  );
  return { repository, audit, events, useCase };
}

function run(harness: ReturnType<typeof build>) {
  return harness.useCase.execute(actor, 'team-1', 'fb-1', {
    reason: 'keying error',
    fields: FIELDS,
  });
}

describe('CorrectFeedbackUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build(feedback(FeedbackStatus.Published));
  });

  it('supersedes and inserts a new revision with a privacy-safe event', async () => {
    const detail = await run(harness);
    expect(detail.feedback.status).toBe(FeedbackStatus.Revised);
    expect(harness.repository.supersede).toHaveBeenCalled();
    const event = harness.events.enqueue.mock.calls[0]?.[1];
    expect(event.payload.supersededId).toBe('fb-1');
    expect(JSON.stringify(event)).not.toContain('secret');
  });

  it('rejects correcting a non-published record', async () => {
    harness = build(feedback(FeedbackStatus.Draft));
    await expect(run(harness)).rejects.toBeInstanceOf(
      FeedbackInvalidTransitionError,
    );
  });

  it('rejects correcting an already-superseded record', async () => {
    harness = build(feedback(FeedbackStatus.Published, NOW));
    await expect(run(harness)).rejects.toBeInstanceOf(
      FeedbackInvalidTransitionError,
    );
  });

  it('rejects when the supersede loses a race', async () => {
    harness = build(feedback(FeedbackStatus.Published), false);
    await expect(run(harness)).rejects.toBeInstanceOf(
      FeedbackInvalidTransitionError,
    );
  });
});
