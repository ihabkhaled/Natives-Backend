import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CoachFeedbackNotFoundError } from '../errors/coach-feedback-not-found.error';
import { FeedbackAlreadyAcknowledgedError } from '../errors/feedback-already-acknowledged.error';
import { FeedbackStatus } from '../model/feedback.enums';
import type {
  CoachFeedback,
  FeedbackAcknowledgement,
} from '../model/feedback.types';
import { AcknowledgeFeedbackUseCase } from './acknowledge-feedback.use-case';

const NOW = new Date('2026-03-01T00:00:00.000Z');
const actor = { userId: 'player-1' } as never;

function feedback(): CoachFeedback {
  return {
    id: 'fb-1',
    familyId: 'fb-1',
    teamId: 'team-1',
    seasonId: null,
    membershipId: 'mem-1',
    authorUserId: 'coach-1',
    status: FeedbackStatus.Published,
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
    publishedAt: NOW,
    publishedBy: 'coach-1',
    supersededAt: null,
    supersededById: null,
    createdBy: 'coach-1',
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function acknowledgement(
  clarificationRequested: boolean,
): FeedbackAcknowledgement {
  return {
    id: 'ack-1',
    feedbackId: 'fb-1',
    membershipId: 'mem-1',
    userId: 'player-1',
    acknowledgedAt: NOW,
    clarificationRequested,
    clarificationNote: clarificationRequested ? 'why' : null,
  };
}

function build(owned: CoachFeedback | null, existingAck = false) {
  const tx = {} as never;
  const unitOfWork = {
    runInTransaction: vi.fn((cb: (t: never) => unknown) => cb(tx)),
  };
  const clock = { now: vi.fn(() => NOW) };
  const idGenerator = { generate: vi.fn(() => 'ack-1') };
  const repository = {
    findOwnedShared: vi.fn(() => owned),
    findAcknowledgement: vi.fn(() =>
      existingAck ? acknowledgement(false) : null,
    ),
    insertAcknowledgement: vi.fn(
      (_scope: never, input: { clarificationRequested: boolean }) =>
        acknowledgement(input.clarificationRequested),
    ),
  };
  const audit = { record: vi.fn() };
  const events = { enqueue: vi.fn() };
  const useCase = new AcknowledgeFeedbackUseCase(
    unitOfWork as never,
    clock as never,
    idGenerator,
    repository as never,
    audit as never,
    events as never,
  );
  return { repository, audit, events, useCase };
}

describe('AcknowledgeFeedbackUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build(feedback());
  });

  it('records an acknowledgement and emits an acknowledged event', async () => {
    const ack = await harness.useCase.execute(actor, 'team-1', 'fb-1', {
      clarificationRequested: false,
      clarificationNote: null,
    });
    expect(ack.id).toBe('ack-1');
    expect(harness.events.enqueue.mock.calls[0]?.[1].eventType).toBe(
      'development.feedback.acknowledged.v1',
    );
  });

  it('emits a clarification event when requested', async () => {
    await harness.useCase.execute(actor, 'team-1', 'fb-1', {
      clarificationRequested: true,
      clarificationNote: 'why',
    });
    expect(harness.events.enqueue.mock.calls[0]?.[1].eventType).toBe(
      'development.feedback.clarificationRequested.v1',
    );
  });

  it('hides feedback not shared with the member', async () => {
    harness = build(null);
    await expect(
      harness.useCase.execute(actor, 'team-1', 'fb-1', {
        clarificationRequested: false,
        clarificationNote: null,
      }),
    ).rejects.toBeInstanceOf(CoachFeedbackNotFoundError);
  });

  it('rejects a second acknowledgement', async () => {
    harness = build(feedback(), true);
    await expect(
      harness.useCase.execute(actor, 'team-1', 'fb-1', {
        clarificationRequested: false,
        clarificationNote: null,
      }),
    ).rejects.toBeInstanceOf(FeedbackAlreadyAcknowledgedError);
  });
});
