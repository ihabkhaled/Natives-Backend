import { describe, expect, it } from 'vitest';

import {
  ActivityCategory,
  ActivityTypeStatus,
  BuddyStatus,
  EvidenceKind,
  EvidenceScanStatus,
  PointsApproval,
  SubmissionStatus,
} from '../model/activity.enums';
import type {
  ActivityBuddy,
  ActivityEvidence,
  ActivitySubmission,
  ActivityType,
} from '../model/activity.types';
import {
  toActivityTypeView,
  toBuddyView,
  toEvidenceView,
  toSubmissionDetailView,
  toSubmissionView,
} from './activity.response.mapper';

const TYPE: ActivityType = {
  id: 'type-1',
  familyId: 'fam-1',
  typeKey: 'gym',
  name: 'Gym',
  description: 'A gym session',
  category: ActivityCategory.Gym,
  unit: 'minutes',
  defaultPointValue: 2,
  pointsApproval: PointsApproval.Approved,
  requiresEvidence: false,
  minDurationMinutes: null,
  maxDurationMinutes: null,
  status: ActivityTypeStatus.Active,
  catalogVersion: 1,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
};

function submission(
  overrides: Partial<ActivitySubmission> = {},
): ActivitySubmission {
  return {
    id: 's1',
    teamId: 't1',
    seasonId: null,
    membershipId: 'm1',
    activityTypeId: 'type-1',
    submitterUserId: 'u1',
    status: SubmissionStatus.Submitted,
    performedOn: '2024-05-30',
    durationMinutes: 60,
    quantity: null,
    notes: 'private note',
    reviewNote: 'REVIEWER-ONLY-SECRET',
    recordVersion: 2,
    submittedAt: new Date('2024-05-31T00:00:00.000Z'),
    submittedBy: 'u1',
    reviewedAt: null,
    reviewedBy: null,
    withdrawnAt: null,
    createdBy: 'u1',
    createdAt: new Date('2024-05-30T00:00:00.000Z'),
    updatedAt: new Date('2024-05-31T00:00:00.000Z'),
    ...overrides,
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

describe('activity.response.mapper', () => {
  it('projects a catalog type view', () => {
    const view = toActivityTypeView(TYPE);
    expect(view.typeKey).toBe('gym');
    expect(view.defaultPointValue).toBe(2);
    expect(view.pointsApproval).toBe(PointsApproval.Approved);
  });

  it('drops the reviewer note from the member submission view', () => {
    const view = toSubmissionView(submission());
    expect(JSON.stringify(view)).not.toContain('REVIEWER-ONLY-SECRET');
    expect('reviewNote' in view).toBe(false);
    expect(view.notes).toBe('private note');
    expect(view.submittedAt).toBe('2024-05-31T00:00:00.000Z');
    expect(view.withdrawnAt).toBeNull();
  });

  it('serialises a withdrawn submission timestamp', () => {
    const view = toSubmissionView(
      submission({
        status: SubmissionStatus.Withdrawn,
        submittedAt: null,
        withdrawnAt: new Date('2024-06-02T00:00:00.000Z'),
      }),
    );
    expect(view.submittedAt).toBeNull();
    expect(view.withdrawnAt).toBe('2024-06-02T00:00:00.000Z');
  });

  it('projects a buddy view without exposing the responder', () => {
    const view = toBuddyView(BUDDY);
    expect(view.status).toBe(BuddyStatus.Pending);
    expect(view.respondedAt).toBeNull();
    expect('respondedBy' in view).toBe(false);
  });

  it('assembles a detail view with buddies and an evidence count', () => {
    const view = toSubmissionDetailView({
      submission: submission(),
      buddies: [BUDDY],
      evidenceCount: 3,
    });
    expect(view.buddies).toHaveLength(1);
    expect(view.evidenceCount).toBe(3);
    expect(view.submission.id).toBe('s1');
  });

  it('projects a reviewer evidence view carrying the private reference', () => {
    const view = toEvidenceView(EVIDENCE);
    expect(view.storageReference).toBe('private/ref');
    expect(view.kind).toBe(EvidenceKind.Link);
  });
});
