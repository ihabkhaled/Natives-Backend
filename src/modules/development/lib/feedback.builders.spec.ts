import { describe, expect, it } from 'vitest';

import { FeedbackStatus } from '../model/feedback.enums';
import type {
  CoachFeedback,
  FeedbackAcknowledgement,
} from '../model/feedback.types';
import {
  buildCorrectionFeedback,
  buildFeedbackAcknowledgedEvent,
  buildFeedbackAudit,
  buildFeedbackPublishedEvent,
  buildFeedbackReminderEvent,
  buildFeedbackRevisedEvent,
  buildFeedbackSupersede,
  buildNewAcknowledgement,
  buildNewFeedback,
  buildPublishTransition,
  buildReopenTransition,
  buildSubmitTransition,
} from './feedback.builders';

const NOW = new Date('2026-03-01T00:00:00.000Z');
const SECRET = 'SECRET-COACH-NOTE';

function feedback(overrides: Partial<CoachFeedback> = {}): CoachFeedback {
  return {
    id: 'fb-1',
    familyId: 'fam-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    membershipId: 'mem-1',
    authorUserId: 'coach-1',
    status: FeedbackStatus.Published,
    revision: 1,
    recordVersion: 1,
    positiveFrisbee: 'good',
    frisbeeImprovement: 'flicks',
    positiveMental: 'calm',
    mentalImprovement: 'comms',
    teamRole: 'handler',
    recommendedPosition: 'cutter',
    summary: 'solid',
    coachNote: SECRET,
    submittedAt: NOW,
    submittedBy: 'coach-1',
    publishedAt: NOW,
    publishedBy: 'coach-1',
    supersededAt: null,
    supersededById: null,
    createdBy: 'coach-1',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

const FIELDS = {
  positiveFrisbee: 'a',
  frisbeeImprovement: 'b',
  positiveMental: 'c',
  mentalImprovement: 'd',
  teamRole: 'e',
  recommendedPosition: 'f',
  summary: 'g',
  coachNote: SECRET,
};

describe('feedback write builders', () => {
  it('builds a fresh draft that is its own family', () => {
    const draft = buildNewFeedback(
      'fb-1',
      'team-1',
      { membershipId: 'mem-1', seasonId: null, fields: FIELDS },
      'coach-1',
      NOW,
    );
    expect(draft.familyId).toBe('fb-1');
    expect(draft.status).toBe(FeedbackStatus.Draft);
    expect(draft.revision).toBe(1);
    expect(draft.createdBy).toBe('coach-1');
  });

  it('builds a correction as the next superseding revision', () => {
    const revision = buildCorrectionFeedback(
      'fb-2',
      feedback(),
      FIELDS,
      'admin-1',
      NOW,
    );
    expect(revision.familyId).toBe('fam-1');
    expect(revision.status).toBe(FeedbackStatus.Revised);
    expect(revision.revision).toBe(2);
    expect(revision.publishedBy).toBe('admin-1');
  });

  it('builds submit, reopen, and publish transitions', () => {
    expect(buildSubmitTransition('fb-1', 'team-1', 1, 'coach-1', NOW)).toEqual({
      id: 'fb-1',
      teamId: 'team-1',
      toStatus: FeedbackStatus.InReview,
      expectedRecordVersion: 1,
      submittedAt: NOW,
      submittedBy: 'coach-1',
      publishedAt: null,
      publishedBy: null,
      now: NOW,
    });
    expect(buildReopenTransition('fb-1', 'team-1', 2, NOW).toStatus).toBe(
      FeedbackStatus.Draft,
    );
    const publish = buildPublishTransition('fb-1', 'team-1', 3, 'coach-1', NOW);
    expect(publish.toStatus).toBe(FeedbackStatus.Published);
    expect(publish.publishedAt).toBe(NOW);
  });

  it('builds a supersede record', () => {
    expect(buildFeedbackSupersede('fb-1', 'fb-2', NOW)).toEqual({
      id: 'fb-1',
      supersededById: 'fb-2',
      now: NOW,
    });
  });

  it('builds a new acknowledgement', () => {
    const ack = buildNewAcknowledgement(
      'ack-1',
      feedback(),
      'player-1',
      { clarificationRequested: true, clarificationNote: 'why?' },
      NOW,
    );
    expect(ack.feedbackId).toBe('fb-1');
    expect(ack.userId).toBe('player-1');
    expect(ack.clarificationRequested).toBe(true);
  });
});

describe('feedback audit and events never leak private content', () => {
  it('records only ids and workflow state in the audit diff', () => {
    const audit = buildFeedbackAudit(
      'development.feedback.published',
      'c',
      feedback(),
    );
    expect(JSON.stringify(audit)).not.toContain(SECRET);
    expect(audit.diff).toEqual({
      status: 'published',
      revision: 1,
      recordVersion: 1,
    });
  });

  it('emits privacy-safe published and revised events', () => {
    const published = buildFeedbackPublishedEvent(feedback());
    expect(published.eventType).toBe('development.feedback.published.v1');
    expect(JSON.stringify(published.payload)).not.toContain(SECRET);
    expect(published.payload).not.toHaveProperty('summary');

    const revised = buildFeedbackRevisedEvent(
      feedback({ status: FeedbackStatus.Revised, revision: 2 }),
      'fb-1',
    );
    expect(revised.payload['supersededId']).toBe('fb-1');
    expect(JSON.stringify(revised)).not.toContain(SECRET);
  });

  it('chooses acknowledged vs clarification event and stays privacy-safe', () => {
    const base: FeedbackAcknowledgement = {
      id: 'ack-1',
      feedbackId: 'fb-1',
      membershipId: 'mem-1',
      userId: 'player-1',
      acknowledgedAt: NOW,
      clarificationRequested: false,
      clarificationNote: null,
    };
    expect(buildFeedbackAcknowledgedEvent(feedback(), base).eventType).toBe(
      'development.feedback.acknowledged.v1',
    );
    const clarify = buildFeedbackAcknowledgedEvent(feedback(), {
      ...base,
      clarificationRequested: true,
      clarificationNote: 'private question',
    });
    expect(clarify.eventType).toBe(
      'development.feedback.clarificationRequested.v1',
    );
    expect(JSON.stringify(clarify)).not.toContain('private question');
  });

  it('emits a privacy-safe reminder event', () => {
    const event = buildFeedbackReminderEvent({
      id: 'fb-1',
      team_id: 'team-1',
      season_id: null,
      membership_id: 'mem-1',
      reminder_user_id: 'player-1',
      published_at: NOW,
    });
    expect(event.eventType).toBe('development.feedback.reminderDue.v1');
    expect(event.payload).toEqual({
      feedbackId: 'fb-1',
      membershipId: 'mem-1',
    });
  });
});
