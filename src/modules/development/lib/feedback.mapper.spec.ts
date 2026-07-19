import { describe, expect, it } from 'vitest';

import { FeedbackStatus } from '../model/feedback.enums';
import type {
  CoachFeedbackRow,
  CoachFeedbackSummaryRow,
  FeedbackAcknowledgementRow,
} from '../model/feedback.rows';
import {
  toCoachFeedback,
  toFeedbackAcknowledgement,
  toFeedbackSummary,
} from './feedback.mapper';

function row(overrides: Partial<CoachFeedbackRow> = {}): CoachFeedbackRow {
  return {
    id: 'fb-1',
    family_id: 'fb-1',
    team_id: 'team-1',
    season_id: null,
    membership_id: 'mem-1',
    author_user_id: 'coach-1',
    status: 'published',
    revision: 2,
    record_version: 3,
    positive_frisbee: 'good hucks',
    frisbee_improvement: 'flicks',
    positive_mental: 'calm',
    mental_improvement: 'comms',
    team_role: 'handler',
    recommended_position: 'cutter',
    summary: 'solid',
    coach_note: 'private note',
    submitted_at: '2026-01-05T00:00:00.000Z',
    submitted_by: 'coach-1',
    published_at: '2026-02-01T00:00:00.000Z',
    published_by: 'coach-1',
    superseded_at: null,
    superseded_by_id: null,
    created_by: 'coach-1',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-02-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('toCoachFeedback', () => {
  it('maps a full row including dates and the coach note', () => {
    const feedback = toCoachFeedback(row());
    expect(feedback.status).toBe(FeedbackStatus.Published);
    expect(feedback.revision).toBe(2);
    expect(feedback.coachNote).toBe('private note');
    expect(feedback.submittedAt).toEqual(new Date('2026-01-05T00:00:00.000Z'));
    expect(feedback.supersededAt).toBeNull();
  });
});

describe('toFeedbackSummary', () => {
  it('maps a note-free summary row', () => {
    const summaryRow: CoachFeedbackSummaryRow = {
      id: 'fb-1',
      family_id: 'fb-1',
      team_id: 'team-1',
      membership_id: 'mem-1',
      author_user_id: 'coach-1',
      status: 'draft',
      revision: 1,
      record_version: 1,
      created_at: '2026-01-01T00:00:00.000Z',
      published_at: null,
    };
    const summary = toFeedbackSummary(summaryRow);
    expect(summary.status).toBe(FeedbackStatus.Draft);
    expect(summary.publishedAt).toBeNull();
    expect(JSON.stringify(summary)).not.toContain('coachNote');
  });
});

describe('toFeedbackAcknowledgement', () => {
  it('maps an acknowledgement row', () => {
    const ackRow: FeedbackAcknowledgementRow = {
      id: 'ack-1',
      feedback_id: 'fb-1',
      membership_id: 'mem-1',
      user_id: 'player-1',
      acknowledged_at: '2026-02-02T00:00:00.000Z',
      clarification_requested: true,
      clarification_note: 'please explain',
      created_at: '2026-02-02T00:00:00.000Z',
    };
    const ack = toFeedbackAcknowledgement(ackRow);
    expect(ack.clarificationRequested).toBe(true);
    expect(ack.acknowledgedAt).toEqual(new Date('2026-02-02T00:00:00.000Z'));
  });
});
