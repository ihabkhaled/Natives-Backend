import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CoachFeedbackNotFoundError } from '../errors/coach-feedback-not-found.error';
import { FeedbackStatus } from '../model/feedback.enums';
import type {
  CoachFeedback,
  FeedbackAcknowledgement,
} from '../model/feedback.types';
import { FeedbackQueryService } from './feedback-query.service';

const SECRET = 'PRIVATE-NOTE';

function feedback(id: string): CoachFeedback {
  return {
    id,
    familyId: id,
    teamId: 'team-1',
    seasonId: null,
    membershipId: 'mem-1',
    authorUserId: 'coach-1',
    status: FeedbackStatus.Published,
    revision: 1,
    recordVersion: 1,
    positiveFrisbee: 'good',
    frisbeeImprovement: null,
    positiveMental: null,
    mentalImprovement: null,
    teamRole: null,
    recommendedPosition: null,
    summary: 'nice',
    coachNote: SECRET,
    submittedAt: null,
    submittedBy: null,
    publishedAt: new Date('2026-02-01T00:00:00.000Z'),
    publishedBy: 'coach-1',
    supersededAt: null,
    supersededById: null,
    createdBy: 'coach-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

function ack(feedbackId: string): FeedbackAcknowledgement {
  return {
    id: `ack-${feedbackId}`,
    feedbackId,
    membershipId: 'mem-1',
    userId: 'player-1',
    acknowledgedAt: new Date('2026-02-02T00:00:00.000Z'),
    clarificationRequested: true,
    clarificationNote: 'why',
  };
}

function build() {
  const tx = {} as never;
  const unitOfWork = {
    runInTransaction: vi.fn((cb: (t: never) => unknown) => cb(tx)),
  };
  const repository = {
    listForTeam: vi.fn(),
    countForTeam: vi.fn(),
    findForWrite: vi.fn(),
    findAcknowledgement: vi.fn(),
    listRevisions: vi.fn(),
    listOwnShared: vi.fn(),
  };
  return {
    repository,
    service: new FeedbackQueryService(unitOfWork as never, repository as never),
  };
}

describe('FeedbackQueryService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('returns a bounded team page', async () => {
    harness.repository.listForTeam.mockResolvedValue([]);
    harness.repository.countForTeam.mockResolvedValue(0);
    await expect(
      harness.service.listForTeam('team-1', { limit: 20, offset: 0 }),
    ).resolves.toEqual({ items: [], total: 0, limit: 20, offset: 0 });
  });

  it('returns a detail with acknowledgement', async () => {
    harness.repository.findForWrite.mockResolvedValue(feedback('fb-1'));
    harness.repository.findAcknowledgement.mockResolvedValue(ack('fb-1'));
    const detail = await harness.service.getDetail('team-1', 'fb-1');
    expect(detail.acknowledgement?.id).toBe('ack-fb-1');
  });

  it('hides a missing detail as not-found', async () => {
    harness.repository.findForWrite.mockResolvedValue(null);
    await expect(
      harness.service.getDetail('team-1', 'fb-x'),
    ).rejects.toBeInstanceOf(CoachFeedbackNotFoundError);
  });

  it('lists revisions for a found family', async () => {
    harness.repository.findForWrite.mockResolvedValue(feedback('fb-1'));
    harness.repository.listRevisions.mockResolvedValue([]);
    await expect(
      harness.service.listRevisions('team-1', 'fb-1'),
    ).resolves.toEqual({ items: [] });
  });

  it('hides revisions of a missing feedback', async () => {
    harness.repository.findForWrite.mockResolvedValue(null);
    await expect(
      harness.service.listRevisions('team-1', 'fb-x'),
    ).rejects.toBeInstanceOf(CoachFeedbackNotFoundError);
  });

  it('shapes the own-shared page and strips the coach note', async () => {
    harness.repository.listOwnShared.mockResolvedValue({
      feedback: [feedback('fb-1'), feedback('fb-2')],
      acknowledgements: new Map([['fb-1', ack('fb-1')]]),
      total: 2,
    });
    const page = await harness.service.listOwnShared('team-1', 'player-1', {
      limit: 20,
      offset: 0,
    });
    expect(JSON.stringify(page)).not.toContain(SECRET);
    expect(page.items[0]?.clarificationRequested).toBe(true);
    expect(page.items[1]?.acknowledgedAt).toBeNull();
    expect(page.total).toBe(2);
  });
});
