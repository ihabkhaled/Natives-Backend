import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FeedbackStatus } from '../model/feedback.enums';
import type { CoachFeedbackRow } from '../model/feedback.rows';
import type {
  NewCoachFeedback,
  NewFeedbackAcknowledgement,
} from '../model/feedback.types';
import { CoachFeedbackRepository } from './coach-feedback.repository';

const NOW = new Date('2026-03-01T00:00:00.000Z');

function build() {
  const scope = { run: vi.fn() };
  return { scope, repository: new CoachFeedbackRepository() };
}

function feedbackRow(
  overrides: Partial<CoachFeedbackRow> = {},
): CoachFeedbackRow {
  return {
    id: 'fb-1',
    family_id: 'fb-1',
    team_id: 'team-1',
    season_id: null,
    membership_id: 'mem-1',
    author_user_id: 'coach-1',
    status: 'draft',
    revision: 1,
    record_version: 1,
    positive_frisbee: null,
    frisbee_improvement: null,
    positive_mental: null,
    mental_improvement: null,
    team_role: null,
    recommended_position: null,
    summary: null,
    coach_note: 'secret',
    submitted_at: null,
    submitted_by: null,
    published_at: null,
    published_by: null,
    superseded_at: null,
    superseded_by_id: null,
    created_by: 'coach-1',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function newFeedback(): NewCoachFeedback {
  return {
    id: 'fb-1',
    familyId: 'fb-1',
    teamId: 'team-1',
    seasonId: null,
    membershipId: 'mem-1',
    authorUserId: 'coach-1',
    status: FeedbackStatus.Draft,
    revision: 1,
    fields: {
      positiveFrisbee: 'a',
      frisbeeImprovement: 'b',
      positiveMental: 'c',
      mentalImprovement: 'd',
      teamRole: 'e',
      recommendedPosition: 'f',
      summary: 'g',
      coachNote: 'secret',
    },
    submittedAt: null,
    submittedBy: null,
    publishedAt: null,
    publishedBy: null,
    createdBy: 'coach-1',
    now: NOW,
  };
}

function newAcknowledgement(): NewFeedbackAcknowledgement {
  return {
    id: 'ack-1',
    feedbackId: 'fb-1',
    membershipId: 'mem-1',
    userId: 'player-1',
    clarificationRequested: false,
    clarificationNote: null,
    now: NOW,
  };
}

describe('CoachFeedbackRepository', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('inserts feedback and maps the returned row', async () => {
    harness.scope.run.mockResolvedValueOnce([feedbackRow()]);
    const feedback = await harness.repository.insertFeedback(
      harness.scope as never,
      newFeedback(),
    );
    expect(feedback.id).toBe('fb-1');
    expect(String(harness.scope.run.mock.calls[0]?.[0])).toContain(
      'INSERT INTO "coach_feedback"',
    );
  });

  it('throws when the insert returns no row', async () => {
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.insertFeedback(harness.scope as never, newFeedback()),
    ).rejects.toThrow('Expected a returned row');
  });

  it('finds a feedback for write or returns null', async () => {
    harness.scope.run.mockResolvedValueOnce([feedbackRow()]);
    await expect(
      harness.repository.findForWrite(harness.scope as never, 'team-1', 'fb-1'),
    ).resolves.not.toBeNull();
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.findForWrite(harness.scope as never, 'team-1', 'fb-x'),
    ).resolves.toBeNull();
  });

  it('updates draft fields or reports a version conflict as null', async () => {
    harness.scope.run.mockResolvedValueOnce([
      feedbackRow({ record_version: 2 }),
    ]);
    await expect(
      harness.repository.updateDraftFields(
        harness.scope as never,
        newFeedback(),
        'fb-1',
        1,
      ),
    ).resolves.not.toBeNull();
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.updateDraftFields(
        harness.scope as never,
        newFeedback(),
        'fb-1',
        9,
      ),
    ).resolves.toBeNull();
  });

  it('applies a transition or reports a conflict as null', async () => {
    const transition = {
      id: 'fb-1',
      teamId: 'team-1',
      toStatus: FeedbackStatus.InReview,
      expectedRecordVersion: 1,
      submittedAt: NOW,
      submittedBy: 'coach-1',
      publishedAt: null,
      publishedBy: null,
      now: NOW,
    };
    harness.scope.run.mockResolvedValueOnce([
      feedbackRow({ status: 'in_review' }),
    ]);
    await expect(
      harness.repository.applyTransition(harness.scope as never, transition),
    ).resolves.not.toBeNull();
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.applyTransition(harness.scope as never, transition),
    ).resolves.toBeNull();
  });

  it('supersedes only when a live published row matches', async () => {
    harness.scope.run.mockResolvedValueOnce([{ id: 'fb-1' }]);
    await expect(
      harness.repository.supersede(harness.scope as never, {
        id: 'fb-1',
        supersededById: 'fb-2',
        now: NOW,
      }),
    ).resolves.toBe(true);
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.supersede(harness.scope as never, {
        id: 'fb-1',
        supersededById: 'fb-2',
        now: NOW,
      }),
    ).resolves.toBe(false);
  });

  it('lists note-free team summaries and counts', async () => {
    harness.scope.run.mockResolvedValueOnce([
      {
        id: 'fb-1',
        family_id: 'fb-1',
        team_id: 'team-1',
        membership_id: 'mem-1',
        author_user_id: 'coach-1',
        status: 'published',
        revision: 1,
        record_version: 1,
        created_at: '2026-01-01T00:00:00.000Z',
        published_at: '2026-02-01T00:00:00.000Z',
      },
    ]);
    const items = await harness.repository.listForTeam(
      harness.scope as never,
      'team-1',
      { limit: 20, offset: 0 },
    );
    expect(items).toHaveLength(1);
    expect(String(harness.scope.run.mock.calls[0]?.[0])).not.toContain(
      'coach_note',
    );

    harness.scope.run.mockResolvedValueOnce([{ count: 3 }]);
    await expect(
      harness.repository.countForTeam(harness.scope as never, 'team-1'),
    ).resolves.toBe(3);
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.countForTeam(harness.scope as never, 'team-1'),
    ).resolves.toBe(0);
  });

  it('lists a revision history', async () => {
    harness.scope.run.mockResolvedValueOnce([
      {
        id: 'fb-1',
        family_id: 'fam-1',
        team_id: 'team-1',
        membership_id: 'mem-1',
        author_user_id: 'coach-1',
        status: 'revised',
        revision: 2,
        record_version: 1,
        created_at: '2026-01-01T00:00:00.000Z',
        published_at: null,
      },
    ]);
    const history = await harness.repository.listRevisions(
      harness.scope as never,
      'team-1',
      'fam-1',
    );
    expect(history[0]?.revision).toBe(2);
  });

  it('assembles the own-shared page with acknowledgements', async () => {
    harness.scope.run
      .mockResolvedValueOnce([feedbackRow({ status: 'published' })])
      .mockResolvedValueOnce([
        {
          id: 'ack-1',
          feedback_id: 'fb-1',
          membership_id: 'mem-1',
          user_id: 'player-1',
          acknowledged_at: '2026-02-02T00:00:00.000Z',
          clarification_requested: false,
          clarification_note: null,
          created_at: '2026-02-02T00:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([{ count: 1 }]);
    const result = await harness.repository.listOwnShared(
      harness.scope as never,
      'team-1',
      'player-1',
      { limit: 20, offset: 0 },
    );
    expect(result.feedback).toHaveLength(1);
    expect(result.acknowledgements.get('fb-1')?.id).toBe('ack-1');
    expect(result.total).toBe(1);
  });

  it('returns an empty own-shared page without querying acknowledgements', async () => {
    harness.scope.run
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: 0 }]);
    const result = await harness.repository.listOwnShared(
      harness.scope as never,
      'team-1',
      'player-1',
      { limit: 20, offset: 0 },
    );
    expect(result.feedback).toHaveLength(0);
    expect(result.acknowledgements.size).toBe(0);
    expect(result.total).toBe(0);
    expect(harness.scope.run).toHaveBeenCalledTimes(2);
  });

  it('finds an owned shared feedback or returns null', async () => {
    harness.scope.run.mockResolvedValueOnce([
      feedbackRow({ status: 'published' }),
    ]);
    await expect(
      harness.repository.findOwnedShared(
        harness.scope as never,
        'team-1',
        'fb-1',
        'player-1',
      ),
    ).resolves.not.toBeNull();
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.findOwnedShared(
        harness.scope as never,
        'team-1',
        'fb-1',
        'other',
      ),
    ).resolves.toBeNull();
  });

  it('inserts an acknowledgement and throws when none returns', async () => {
    harness.scope.run.mockResolvedValueOnce([
      {
        id: 'ack-1',
        feedback_id: 'fb-1',
        membership_id: 'mem-1',
        user_id: 'player-1',
        acknowledged_at: '2026-02-02T00:00:00.000Z',
        clarification_requested: false,
        clarification_note: null,
        created_at: '2026-02-02T00:00:00.000Z',
      },
    ]);
    await expect(
      harness.repository.insertAcknowledgement(
        harness.scope as never,
        newAcknowledgement(),
      ),
    ).resolves.not.toBeNull();
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.insertAcknowledgement(
        harness.scope as never,
        newAcknowledgement(),
      ),
    ).rejects.toThrow('Expected a returned row');
  });

  it('finds an acknowledgement or returns null', async () => {
    harness.scope.run.mockResolvedValueOnce([
      {
        id: 'ack-1',
        feedback_id: 'fb-1',
        membership_id: 'mem-1',
        user_id: 'player-1',
        acknowledged_at: '2026-02-02T00:00:00.000Z',
        clarification_requested: true,
        clarification_note: 'why',
        created_at: '2026-02-02T00:00:00.000Z',
      },
    ]);
    await expect(
      harness.repository.findAcknowledgement(harness.scope as never, 'fb-1'),
    ).resolves.not.toBeNull();
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.findAcknowledgement(harness.scope as never, 'fb-x'),
    ).resolves.toBeNull();
  });

  it('lists unacknowledged reminders bounded by the scan cap', async () => {
    harness.scope.run.mockResolvedValueOnce([
      {
        id: 'fb-1',
        team_id: 'team-1',
        season_id: null,
        membership_id: 'mem-1',
        reminder_user_id: 'player-1',
        published_at: '2026-02-01T00:00:00.000Z',
      },
    ]);
    const rows = await harness.repository.listReminders(
      harness.scope as never,
      'team-1',
    );
    expect(rows).toHaveLength(1);
    expect(String(harness.scope.run.mock.calls[0]?.[0])).toContain(
      'a."id" IS NULL',
    );
  });
});
