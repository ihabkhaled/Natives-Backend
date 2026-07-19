import {
  ACTIVITY_CATEGORY_VALUES,
  ACTIVITY_TYPE_STATUS_VALUES,
  BUDDY_STATUS_VALUES,
  EVIDENCE_KIND_VALUES,
  EVIDENCE_SCAN_STATUS_VALUES,
  POINTS_APPROVAL_VALUES,
  SUBMISSION_STATUS_VALUES,
} from '../model/activity.enums';
import type {
  ActivityBuddyRow,
  ActivityEvidenceRow,
  ActivitySubmissionRow,
  ActivityTypeRow,
} from '../model/activity.rows';
import type {
  ActivityBuddy,
  ActivityEvidence,
  ActivitySubmission,
  ActivityType,
} from '../model/activity.types';
import {
  parseEnumValue,
  toDate,
  toNullableDate,
  toNullableNumber,
} from './activity.helpers';

export function toActivityType(row: ActivityTypeRow): ActivityType {
  return {
    id: row.id,
    familyId: row.family_id,
    typeKey: row.type_key,
    name: row.name,
    description: row.description,
    category: parseEnumValue(
      ACTIVITY_CATEGORY_VALUES,
      row.category,
      'category',
    ),
    unit: row.unit,
    defaultPointValue: toNullableNumber(row.default_point_value),
    pointsApproval: parseEnumValue(
      POINTS_APPROVAL_VALUES,
      row.points_approval,
      'points approval',
    ),
    requiresEvidence: row.requires_evidence,
    minDurationMinutes: row.min_duration_minutes,
    maxDurationMinutes: row.max_duration_minutes,
    status: parseEnumValue(
      ACTIVITY_TYPE_STATUS_VALUES,
      row.status,
      'activity type status',
    ),
    catalogVersion: row.catalog_version,
    createdAt: toDate(row.created_at),
  };
}

export function toActivitySubmission(
  row: ActivitySubmissionRow,
): ActivitySubmission {
  return {
    id: row.id,
    teamId: row.team_id,
    seasonId: row.season_id,
    membershipId: row.membership_id,
    activityTypeId: row.activity_type_id,
    submitterUserId: row.submitter_user_id,
    status: parseEnumValue(
      SUBMISSION_STATUS_VALUES,
      row.status,
      'submission status',
    ),
    performedOn: row.performed_on,
    durationMinutes: row.duration_minutes,
    quantity: toNullableNumber(row.quantity),
    notes: row.notes,
    reviewNote: row.review_note,
    recordVersion: row.record_version,
    submittedAt: toNullableDate(row.submitted_at),
    submittedBy: row.submitted_by,
    reviewedAt: toNullableDate(row.reviewed_at),
    reviewedBy: row.reviewed_by,
    reviewerUserId: row.reviewer_user_id,
    reviewStartedAt: toNullableDate(row.review_started_at),
    reversalReason: row.reversal_reason,
    reversedAt: toNullableDate(row.reversed_at),
    reversedBy: row.reversed_by,
    withdrawnAt: toNullableDate(row.withdrawn_at),
    createdBy: row.created_by,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function toActivityEvidence(row: ActivityEvidenceRow): ActivityEvidence {
  return {
    id: row.id,
    submissionId: row.submission_id,
    kind: parseEnumValue(EVIDENCE_KIND_VALUES, row.kind, 'evidence kind'),
    storageReference: row.storage_reference,
    contentType: row.content_type,
    byteSize: toNullableNumber(row.byte_size),
    description: row.description,
    scanStatus: parseEnumValue(
      EVIDENCE_SCAN_STATUS_VALUES,
      row.scan_status,
      'evidence scan status',
    ),
    createdBy: row.created_by,
    createdAt: toDate(row.created_at),
  };
}

export function toActivityBuddy(row: ActivityBuddyRow): ActivityBuddy {
  return {
    id: row.id,
    submissionId: row.submission_id,
    membershipId: row.membership_id,
    status: parseEnumValue(BUDDY_STATUS_VALUES, row.status, 'buddy status'),
    respondedAt: toNullableDate(row.responded_at),
    respondedBy: row.responded_by,
    createdAt: toDate(row.created_at),
  };
}
