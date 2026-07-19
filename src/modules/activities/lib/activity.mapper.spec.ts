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
  ActivityBuddyRow,
  ActivityEvidenceRow,
  ActivitySubmissionRow,
  ActivityTypeRow,
} from '../model/activity.rows';
import {
  toActivityBuddy,
  toActivityEvidence,
  toActivitySubmission,
  toActivityType,
} from './activity.mapper';

const TYPE_ROW: ActivityTypeRow = {
  id: 'type-1',
  family_id: 'fam-1',
  type_key: 'gym',
  name: 'Gym',
  description: 'A gym session',
  category: 'gym',
  unit: 'minutes',
  default_point_value: '2',
  points_approval: 'approved',
  requires_evidence: false,
  min_duration_minutes: null,
  max_duration_minutes: 120,
  status: 'active',
  catalog_version: 1,
  created_at: '2024-01-01T00:00:00.000Z',
};

const SUBMISSION_ROW: ActivitySubmissionRow = {
  id: 's1',
  team_id: 't1',
  season_id: null,
  membership_id: 'm1',
  activity_type_id: 'type-1',
  submitter_user_id: 'u1',
  status: 'submitted',
  performed_on: '2024-05-30',
  duration_minutes: 60,
  quantity: null,
  notes: 'felt good',
  review_note: null,
  record_version: 2,
  submitted_at: '2024-05-31T00:00:00.000Z',
  submitted_by: 'u1',
  reviewed_at: null,
  reviewed_by: null,
  reviewer_user_id: null,
  review_started_at: null,
  reversal_reason: null,
  reversed_at: null,
  reversed_by: null,
  withdrawn_at: null,
  created_by: 'u1',
  created_at: '2024-05-30T00:00:00.000Z',
  updated_at: '2024-05-31T00:00:00.000Z',
  deleted_at: null,
};

describe('activity.mapper', () => {
  it('maps a catalog type row with a candidate point value', () => {
    const type = toActivityType(TYPE_ROW);
    expect(type.category).toBe(ActivityCategory.Gym);
    expect(type.pointsApproval).toBe(PointsApproval.Approved);
    expect(type.status).toBe(ActivityTypeStatus.Active);
    expect(type.defaultPointValue).toBe(2);
    expect(type.maxDurationMinutes).toBe(120);
  });

  it('keeps a pending WFDF type point value null', () => {
    const type = toActivityType({
      ...TYPE_ROW,
      default_point_value: null,
      points_approval: 'pending',
      category: 'accreditation',
    });
    expect(type.defaultPointValue).toBeNull();
    expect(type.pointsApproval).toBe(PointsApproval.Pending);
    expect(type.category).toBe(ActivityCategory.Accreditation);
  });

  it('maps a submission row (null-not-zero quantity)', () => {
    const submission = toActivitySubmission(SUBMISSION_ROW);
    expect(submission.status).toBe(SubmissionStatus.Submitted);
    expect(submission.quantity).toBeNull();
    expect(submission.durationMinutes).toBe(60);
    expect(submission.submittedAt).toEqual(
      new Date('2024-05-31T00:00:00.000Z'),
    );
    expect(submission.withdrawnAt).toBeNull();
  });

  it('maps reviewer + reversal fields on a corrected submission', () => {
    const submission = toActivitySubmission({
      ...SUBMISSION_ROW,
      status: 'reversed',
      review_note: 'looks off',
      reviewed_at: '2024-06-02T00:00:00.000Z',
      reviewed_by: 'coach-1',
      reviewer_user_id: 'coach-1',
      review_started_at: '2024-06-01T00:00:00.000Z',
      reversal_reason: 'duplicate of another claim',
      reversed_at: '2024-06-03T00:00:00.000Z',
      reversed_by: 'admin-1',
    });
    expect(submission.status).toBe(SubmissionStatus.Reversed);
    expect(submission.reviewerUserId).toBe('coach-1');
    expect(submission.reviewStartedAt).toEqual(
      new Date('2024-06-01T00:00:00.000Z'),
    );
    expect(submission.reversalReason).toBe('duplicate of another claim');
    expect(submission.reversedAt).toEqual(new Date('2024-06-03T00:00:00.000Z'));
    expect(submission.reversedBy).toBe('admin-1');
  });

  it('maps an evidence row with its private reference', () => {
    const row: ActivityEvidenceRow = {
      id: 'e1',
      submission_id: 's1',
      kind: 'file',
      storage_reference: 'private/key/1',
      content_type: 'image/png',
      byte_size: '2048',
      description: null,
      scan_status: 'clean',
      created_by: 'u1',
      created_at: '2024-05-30T00:00:00.000Z',
    };
    const evidence = toActivityEvidence(row);
    expect(evidence.kind).toBe(EvidenceKind.File);
    expect(evidence.scanStatus).toBe(EvidenceScanStatus.Clean);
    expect(evidence.storageReference).toBe('private/key/1');
    expect(evidence.byteSize).toBe(2048);
  });

  it('maps a buddy row', () => {
    const row: ActivityBuddyRow = {
      id: 'b1',
      submission_id: 's1',
      membership_id: 'm2',
      status: 'pending',
      responded_at: null,
      responded_by: null,
      created_at: '2024-05-30T00:00:00.000Z',
    };
    const buddy = toActivityBuddy(row);
    expect(buddy.status).toBe(BuddyStatus.Pending);
    expect(buddy.respondedAt).toBeNull();
    expect(buddy.membershipId).toBe('m2');
  });
});
