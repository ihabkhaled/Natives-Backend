import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ActivitySubmissionNotFoundError } from '../errors/activity-submission-not-found.error';
import { BuddyStatus, SubmissionStatus } from '../model/activity.enums';
import type {
  ActivityBuddy,
  ActivitySubmission,
} from '../model/activity.types';
import { SubmissionQueryService } from './submission-query.service';

function submission(id: string, userId: string): ActivitySubmission {
  return {
    id,
    teamId: 't1',
    seasonId: null,
    membershipId: 'm1',
    activityTypeId: 'type-1',
    submitterUserId: userId,
    status: SubmissionStatus.Draft,
    performedOn: '2024-05-30',
    durationMinutes: null,
    quantity: null,
    notes: null,
    reviewNote: 'REVIEWER-ONLY',
    recordVersion: 1,
    submittedAt: null,
    submittedBy: null,
    reviewedAt: null,
    reviewedBy: null,
    withdrawnAt: null,
    createdBy: userId,
    createdAt: new Date('2024-05-30T00:00:00.000Z'),
    updatedAt: new Date('2024-05-30T00:00:00.000Z'),
  };
}

const BUDDY: ActivityBuddy = {
  id: 'b1',
  submissionId: 's1',
  membershipId: 'm2',
  status: BuddyStatus.Pending,
  respondedAt: null,
  respondedBy: null,
  createdAt: new Date('2024-05-30T00:00:00.000Z'),
};

function build() {
  const tx = {} as never;
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(tx)),
  };
  const submissions = {
    listForMember: vi.fn(),
    countForMember: vi.fn(),
    findForWrite: vi.fn(),
  };
  const buddies = {
    listForSubmission: vi.fn(),
    buddiesBySubmission: vi.fn(),
  };
  const evidence = {
    countForSubmission: vi.fn(),
    countsBySubmission: vi.fn(),
  };
  const service = new SubmissionQueryService(
    unitOfWork as never,
    submissions as never,
    buddies as never,
    evidence as never,
  );
  return { unitOfWork, submissions, buddies, evidence, service };
}

describe('SubmissionQueryService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('lists a member’s submissions as member-safe detail views', async () => {
    harness.submissions.listForMember.mockResolvedValue([
      submission('s1', 'u1'),
    ]);
    harness.submissions.countForMember.mockResolvedValue(1);
    harness.buddies.buddiesBySubmission.mockResolvedValue(new Map());
    harness.evidence.countsBySubmission.mockResolvedValue(new Map());
    const page = await harness.service.listForMember('t1', 'u1', {
      limit: 20,
      offset: 0,
    });
    expect(page.total).toBe(1);
    expect(page.items[0]?.buddies).toEqual([]);
    expect(page.items[0]?.evidenceCount).toBe(0);
    expect(JSON.stringify(page)).not.toContain('REVIEWER-ONLY');
  });

  it('returns the owner’s detail with buddies and an evidence count', async () => {
    harness.submissions.findForWrite.mockResolvedValue(submission('s1', 'u1'));
    harness.buddies.listForSubmission.mockResolvedValue([BUDDY]);
    harness.evidence.countForSubmission.mockResolvedValue(2);
    const detail = await harness.service.getOwnDetail('t1', 'u1', 's1');
    expect(detail.buddies).toHaveLength(1);
    expect(detail.evidenceCount).toBe(2);
    expect(JSON.stringify(detail)).not.toContain('REVIEWER-ONLY');
  });

  it('hides a missing submission from the owner as a 404', async () => {
    harness.submissions.findForWrite.mockResolvedValue(null);
    await expect(
      harness.service.getOwnDetail('t1', 'u1', 'sx'),
    ).rejects.toBeInstanceOf(ActivitySubmissionNotFoundError);
  });

  it('hides another member’s submission as a 404', async () => {
    harness.submissions.findForWrite.mockResolvedValue(submission('s1', 'u2'));
    await expect(
      harness.service.getOwnDetail('t1', 'u1', 's1'),
    ).rejects.toBeInstanceOf(ActivitySubmissionNotFoundError);
  });
});
