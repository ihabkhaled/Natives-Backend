import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ActivitySubmissionNotFoundError } from '../errors/activity-submission-not-found.error';
import {
  EvidenceKind,
  EvidenceScanStatus,
  SubmissionStatus,
} from '../model/activity.enums';
import type {
  ActivityEvidence,
  ActivitySubmission,
} from '../model/activity.types';
import { EvidenceQueryService } from './evidence-query.service';

const SUBMISSION: ActivitySubmission = {
  id: 's1',
  teamId: 't1',
  seasonId: null,
  membershipId: 'm1',
  activityTypeId: 'type-1',
  submitterUserId: 'u1',
  status: SubmissionStatus.Submitted,
  performedOn: '2024-05-30',
  durationMinutes: null,
  quantity: null,
  notes: null,
  reviewNote: null,
  recordVersion: 1,
  submittedAt: null,
  submittedBy: null,
  reviewedAt: null,
  reviewedBy: null,
  withdrawnAt: null,
  createdBy: 'u1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const EVIDENCE: ActivityEvidence = {
  id: 'e1',
  submissionId: 's1',
  kind: EvidenceKind.Link,
  storageReference: 'private/ref',
  contentType: null,
  byteSize: null,
  description: null,
  scanStatus: EvidenceScanStatus.Pending,
  createdBy: 'u1',
  createdAt: new Date('2024-05-30T00:00:00.000Z'),
};

function build() {
  const tx = {} as never;
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(tx)),
  };
  const submissions = { findForWrite: vi.fn() };
  const evidence = { listForSubmission: vi.fn() };
  const service = new EvidenceQueryService(
    unitOfWork as never,
    submissions as never,
    evidence as never,
  );
  return { submissions, evidence, service };
}

describe('EvidenceQueryService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('lists evidence with its private reference for a valid submission', async () => {
    harness.submissions.findForWrite.mockResolvedValue(SUBMISSION);
    harness.evidence.listForSubmission.mockResolvedValue([EVIDENCE]);
    const page = await harness.service.listForReview('t1', 's1');
    expect(page.total).toBe(1);
    expect(page.items[0]?.storageReference).toBe('private/ref');
  });

  it('hides a submission outside the team as a 404', async () => {
    harness.submissions.findForWrite.mockResolvedValue(null);
    await expect(
      harness.service.listForReview('t1', 'sx'),
    ).rejects.toBeInstanceOf(ActivitySubmissionNotFoundError);
  });
});
