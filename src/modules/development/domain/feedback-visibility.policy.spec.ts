import { describe, expect, it } from 'vitest';

import { FeedbackStatus } from '../model/feedback.enums';
import type {
  CoachFeedback,
  FeedbackAcknowledgement,
} from '../model/feedback.types';
import {
  isPlayerVisible,
  toSharedFeedback,
} from './feedback-visibility.policy';

const SECRET_NOTE = 'PRIVATE-COACH-NOTE-do-not-leak';

function feedback(overrides: Partial<CoachFeedback> = {}): CoachFeedback {
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
    positiveFrisbee: 'great hucks',
    frisbeeImprovement: 'work on flicks',
    positiveMental: 'calm under pressure',
    mentalImprovement: 'communicate more',
    teamRole: 'handler',
    recommendedPosition: 'cutter',
    summary: 'solid season',
    coachNote: SECRET_NOTE,
    submittedAt: null,
    submittedBy: null,
    publishedAt: new Date('2026-02-01T00:00:00.000Z'),
    publishedBy: 'coach-1',
    supersededAt: null,
    supersededById: null,
    createdBy: 'coach-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function acknowledgement(
  overrides: Partial<FeedbackAcknowledgement> = {},
): FeedbackAcknowledgement {
  return {
    id: 'ack-1',
    feedbackId: 'fb-1',
    membershipId: 'mem-1',
    userId: 'player-1',
    acknowledgedAt: new Date('2026-02-02T00:00:00.000Z'),
    clarificationRequested: false,
    clarificationNote: null,
    ...overrides,
  };
}

describe('isPlayerVisible', () => {
  it('is true only for published and revised', () => {
    expect(isPlayerVisible(FeedbackStatus.Published)).toBe(true);
    expect(isPlayerVisible(FeedbackStatus.Revised)).toBe(true);
    expect(isPlayerVisible(FeedbackStatus.Draft)).toBe(false);
    expect(isPlayerVisible(FeedbackStatus.InReview)).toBe(false);
  });
});

describe('toSharedFeedback', () => {
  it('never carries the private coach note in the shaped projection', () => {
    const shared = toSharedFeedback(feedback(), null);
    const serialized = JSON.stringify(shared);
    expect(serialized).not.toContain('coachNote');
    expect(serialized).not.toContain(SECRET_NOTE);
    expect('coachNote' in shared).toBe(false);
  });

  it('maps the member-visible structured fields', () => {
    const shared = toSharedFeedback(feedback(), null);
    expect(shared.positiveFrisbee).toBe('great hucks');
    expect(shared.summary).toBe('solid season');
    expect(shared.acknowledgedAt).toBeNull();
    expect(shared.clarificationRequested).toBe(false);
  });

  it('reflects an acknowledgement when present', () => {
    const ack = acknowledgement({ clarificationRequested: true });
    const shared = toSharedFeedback(feedback(), ack);
    expect(shared.acknowledgedAt).toEqual(ack.acknowledgedAt);
    expect(shared.clarificationRequested).toBe(true);
  });
});
