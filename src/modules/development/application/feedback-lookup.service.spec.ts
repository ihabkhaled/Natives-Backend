import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CoachFeedbackNotFoundError } from '../errors/coach-feedback-not-found.error';
import { FeedbackStatus } from '../model/feedback.enums';
import type { CoachFeedback } from '../model/feedback.types';
import { FeedbackLookupService } from './feedback-lookup.service';

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
    coachNote: null,
    submittedAt: null,
    submittedBy: null,
    publishedAt: null,
    publishedBy: null,
    supersededAt: null,
    supersededById: null,
    createdBy: 'coach-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

function build() {
  const repository = { findForWrite: vi.fn() };
  return {
    repository,
    service: new FeedbackLookupService(repository as never),
    tx: {} as never,
  };
}

describe('FeedbackLookupService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('returns a found feedback for write', async () => {
    harness.repository.findForWrite.mockResolvedValue(feedback());
    await expect(
      harness.service.requireForWrite(harness.tx, 'team-1', 'fb-1'),
    ).resolves.not.toBeNull();
  });

  it('hides a missing feedback as not-found', async () => {
    harness.repository.findForWrite.mockResolvedValue(null);
    await expect(
      harness.service.requireForWrite(harness.tx, 'team-1', 'fb-x'),
    ).rejects.toBeInstanceOf(CoachFeedbackNotFoundError);
  });

  it('accepts the authoring coach', () => {
    expect(() =>
      harness.service.requireAuthor(feedback(), 'coach-1'),
    ).not.toThrow();
  });

  it('hides another coach’s draft as not-found', () => {
    expect(() => harness.service.requireAuthor(feedback(), 'coach-2')).toThrow(
      CoachFeedbackNotFoundError,
    );
  });
});
