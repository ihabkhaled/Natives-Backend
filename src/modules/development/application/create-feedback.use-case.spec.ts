import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FeedbackStatus } from '../model/feedback.enums';
import type { CoachFeedback } from '../model/feedback.types';
import { CreateFeedbackUseCase } from './create-feedback.use-case';

const NOW = new Date('2026-03-01T00:00:00.000Z');
const actor = { userId: 'coach-1' } as never;

function feedback(): CoachFeedback {
  return {
    id: 'fb-1',
    familyId: 'fb-1',
    teamId: 'team-1',
    seasonId: null,
    membershipId: 'mem-1',
    authorUserId: 'coach-1',
    status: FeedbackStatus.Draft,
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
    submittedAt: null,
    submittedBy: null,
    publishedAt: null,
    publishedBy: null,
    supersededAt: null,
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
  summary: null,
  coachNote: 'secret',
};

function build() {
  const tx = {} as never;
  const unitOfWork = {
    runInTransaction: vi.fn((cb: (t: never) => unknown) => cb(tx)),
  };
  const clock = { now: vi.fn(() => NOW) };
  const idGenerator = { generate: vi.fn(() => 'fb-1') };
  const scope = { validate: vi.fn(), requireMembership: vi.fn() };
  const repository = { insertFeedback: vi.fn(() => feedback()) };
  const audit = { record: vi.fn() };
  const useCase = new CreateFeedbackUseCase(
    unitOfWork as never,
    clock as never,
    idGenerator,
    scope as never,
    repository as never,
    audit as never,
  );
  return { scope, repository, audit, useCase };
}

describe('CreateFeedbackUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('validates scope, persists a draft, and audits', async () => {
    const detail = await harness.useCase.execute(actor, 'team-1', {
      membershipId: 'mem-1',
      seasonId: null,
      fields: FIELDS,
    });
    expect(harness.scope.validate).toHaveBeenCalledWith(
      expect.anything(),
      'team-1',
      null,
    );
    expect(harness.scope.requireMembership).toHaveBeenCalled();
    expect(harness.repository.insertFeedback).toHaveBeenCalled();
    expect(harness.audit.record).toHaveBeenCalled();
    expect(detail.acknowledgement).toBeNull();
    expect(detail.feedback.status).toBe(FeedbackStatus.Draft);
  });
});
