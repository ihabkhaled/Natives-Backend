import { describe, expect, it } from 'vitest';

import { REVIEW_QUEUE_DEFAULT_STATUSES } from '../model/activities.constants';
import {
  EvidenceKind,
  ReviewDecision,
  SubmissionStatus,
} from '../model/activity.enums';
import {
  toBuddyMembershipIds,
  toEvidenceItems,
  toReviewCorrectionCommand,
  toReviewDecisionCommand,
  toReviewQueueQuery,
  toSubmissionContent,
} from './activity-command.mapper';

const PAGE = { limit: 20, offset: 0 };

describe('activity-command.mapper', () => {
  it('normalises full submission content', () => {
    expect(
      toSubmissionContent({
        activityTypeId: 'type-1',
        seasonId: 'season-1',
        performedOn: '2024-05-30',
        durationMinutes: 60,
        quantity: 5,
        notes: 'note',
      }),
    ).toEqual({
      activityTypeId: 'type-1',
      seasonId: 'season-1',
      performedOn: '2024-05-30',
      durationMinutes: 60,
      quantity: 5,
      notes: 'note',
    });
  });

  it('defaults omitted optional content to null (null-not-zero)', () => {
    expect(
      toSubmissionContent({
        activityTypeId: 'type-1',
        performedOn: '2024-05-30',
      }),
    ).toEqual({
      activityTypeId: 'type-1',
      seasonId: null,
      performedOn: '2024-05-30',
      durationMinutes: null,
      quantity: null,
      notes: null,
    });
  });

  it('normalises evidence items and defaults undefined to an empty list', () => {
    expect(toEvidenceItems(undefined)).toEqual([]);
    expect(
      toEvidenceItems([
        { kind: EvidenceKind.Link, storageReference: 'ref' },
        {
          kind: EvidenceKind.File,
          storageReference: 'ref2',
          contentType: 'image/png',
          byteSize: 10,
          description: 'proof',
        },
      ]),
    ).toEqual([
      {
        kind: EvidenceKind.Link,
        storageReference: 'ref',
        contentType: null,
        byteSize: null,
        description: null,
      },
      {
        kind: EvidenceKind.File,
        storageReference: 'ref2',
        contentType: 'image/png',
        byteSize: 10,
        description: 'proof',
      },
    ]);
  });

  it('defaults omitted buddy ids to an empty list', () => {
    expect(toBuddyMembershipIds(undefined)).toEqual([]);
    expect(toBuddyMembershipIds(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('defaults the review queue to the actionable states', () => {
    expect(toReviewQueueQuery(undefined, undefined, undefined, PAGE)).toEqual({
      page: PAGE,
      statuses: REVIEW_QUEUE_DEFAULT_STATUSES,
      activityTypeId: null,
      membershipId: null,
    });
  });

  it('narrows the review queue to an allowlisted status and filters', () => {
    expect(
      toReviewQueueQuery(SubmissionStatus.Approved, 'type-1', 'm1', PAGE),
    ).toEqual({
      page: PAGE,
      statuses: [SubmissionStatus.Approved],
      activityTypeId: 'type-1',
      membershipId: 'm1',
    });
  });

  it('normalises a review decision command with its fixed decision', () => {
    expect(
      toReviewDecisionCommand(
        { expectedRecordVersion: 2 },
        ReviewDecision.Approve,
      ),
    ).toEqual({
      expectedRecordVersion: 2,
      decision: ReviewDecision.Approve,
      reviewNote: null,
    });
    expect(
      toReviewDecisionCommand(
        { expectedRecordVersion: 2, reviewNote: 'nope' },
        ReviewDecision.Reject,
      ),
    ).toEqual({
      expectedRecordVersion: 2,
      decision: ReviewDecision.Reject,
      reviewNote: 'nope',
    });
  });

  it('normalises a correction command', () => {
    expect(
      toReviewCorrectionCommand({
        expectedRecordVersion: 3,
        reason: 'duplicate',
      }),
    ).toEqual({ expectedRecordVersion: 3, reason: 'duplicate' });
  });
});
