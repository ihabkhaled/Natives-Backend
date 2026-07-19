import { AuditOutcome } from '@modules/platform';
import { describe, expect, it } from 'vitest';

import {
  ACTIVITY_SUBMITTED_EVENT,
  ACTIVITY_WITHDRAWN_EVENT,
} from '../model/activities.constants';
import {
  BuddyStatus,
  EvidenceKind,
  SubmissionStatus,
} from '../model/activity.enums';
import type {
  ActivityBuddy,
  ActivitySubmission,
  CreateSubmissionCommand,
  EvidenceItem,
} from '../model/activity.types';
import {
  buildActivitySubmittedEvent,
  buildActivityWithdrawnEvent,
  buildBuddyAudit,
  buildBuddyResponseUpdate,
  buildBuddyRows,
  buildContentUpdate,
  buildEvidenceRows,
  buildNewSubmission,
  buildStatusChange,
  buildSubmissionAudit,
} from './activity.builders';

const NOW = new Date('2024-06-01T00:00:00.000Z');

const COMMAND: CreateSubmissionCommand = {
  content: {
    activityTypeId: 'type-1',
    seasonId: 'season-1',
    performedOn: '2024-05-30',
    durationMinutes: 60,
    quantity: null,
    notes: 'SECRET-NOTE',
  },
  buddyMembershipIds: ['m2', 'm3'],
  evidence: [],
};

function submission(
  overrides: Partial<ActivitySubmission> = {},
): ActivitySubmission {
  return {
    id: 's1',
    teamId: 't1',
    seasonId: 'season-1',
    membershipId: 'm1',
    activityTypeId: 'type-1',
    submitterUserId: 'u1',
    status: SubmissionStatus.Submitted,
    performedOn: '2024-05-30',
    durationMinutes: 60,
    quantity: null,
    notes: 'SECRET-NOTE',
    reviewNote: null,
    recordVersion: 2,
    submittedAt: NOW,
    submittedBy: 'u1',
    reviewedAt: null,
    reviewedBy: null,
    withdrawnAt: null,
    createdBy: 'u1',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('activity.builders', () => {
  it('builds a draft submission with the resolved membership', () => {
    const draft = buildNewSubmission('s1', 't1', 'm1', 'u1', COMMAND, NOW);
    expect(draft).toMatchObject({
      id: 's1',
      teamId: 't1',
      membershipId: 'm1',
      submitterUserId: 'u1',
      status: SubmissionStatus.Draft,
    });
  });

  it('builds buddy rows with a resolved status and generated ids', () => {
    let counter = 0;
    const nextId = (): string => {
      counter += 1;
      return `id-${counter}`;
    };
    const rows = buildBuddyRows(
      's1',
      ['m2', 'm3'],
      BuddyStatus.Pending,
      nextId,
      NOW,
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      id: 'id-1',
      submissionId: 's1',
      membershipId: 'm2',
      status: BuddyStatus.Pending,
      now: NOW,
    });
  });

  it('builds evidence rows preserving metadata', () => {
    const items: readonly EvidenceItem[] = [
      {
        kind: EvidenceKind.Link,
        storageReference: 'ref',
        contentType: null,
        byteSize: null,
        description: null,
      },
    ];
    const rows = buildEvidenceRows('s1', items, 'u1', () => 'ev-1', NOW);
    expect(rows[0]).toEqual({
      id: 'ev-1',
      submissionId: 's1',
      item: items[0],
      createdBy: 'u1',
      now: NOW,
    });
  });

  it('builds a content update carrying the expected version', () => {
    expect(
      buildContentUpdate('s1', 't1', 3, COMMAND.content, NOW),
    ).toMatchObject({ id: 's1', teamId: 't1', expectedRecordVersion: 3 });
  });

  it('builds a status change and a buddy response update', () => {
    expect(
      buildStatusChange('s1', 't1', 2, SubmissionStatus.Withdrawn, 'u1', NOW),
    ).toEqual({
      id: 's1',
      teamId: 't1',
      expectedRecordVersion: 2,
      toStatus: SubmissionStatus.Withdrawn,
      actorUserId: 'u1',
      now: NOW,
    });
    expect(
      buildBuddyResponseUpdate('b1', BuddyStatus.Confirmed, 'u2', NOW),
    ).toEqual({
      id: 'b1',
      toStatus: BuddyStatus.Confirmed,
      actorUserId: 'u2',
      now: NOW,
    });
  });

  it('builds a submission audit with a scalar diff and success outcome', () => {
    const audit = buildSubmissionAudit(
      'activities.submission.submitted',
      'u1',
      submission(),
    );
    expect(audit.outcome).toBe(AuditOutcome.Success);
    expect(audit.resourceId).toBe('s1');
    expect(audit.diff).toEqual({
      status: SubmissionStatus.Submitted,
      recordVersion: 2,
      activityTypeId: 'type-1',
    });
  });

  it('builds a buddy audit scoped to the team', () => {
    const buddy: ActivityBuddy = {
      id: 'b1',
      submissionId: 's1',
      membershipId: 'm2',
      status: BuddyStatus.Confirmed,
      respondedAt: NOW,
      respondedBy: 'u2',
      createdAt: NOW,
    };
    const audit = buildBuddyAudit(
      'activities.buddy.responded',
      'u2',
      buddy,
      't1',
    );
    expect(audit.teamId).toBe('t1');
    expect(audit.resourceId).toBe('b1');
    expect(audit.diff).toEqual({
      status: BuddyStatus.Confirmed,
      submissionId: 's1',
    });
  });

  it('builds a privacy-safe ActivitySubmitted event (no notes)', () => {
    const event = buildActivitySubmittedEvent(submission(), 2);
    expect(event.eventType).toBe(ACTIVITY_SUBMITTED_EVENT);
    expect(event.payload).toEqual({
      submissionId: 's1',
      membershipId: 'm1',
      activityTypeId: 'type-1',
      status: SubmissionStatus.Submitted,
      performedOn: '2024-05-30',
      durationMinutes: 60,
      buddyCount: 2,
    });
    expect(JSON.stringify(event)).not.toContain('SECRET-NOTE');
  });

  it('builds an ActivityWithdrawn event', () => {
    const event = buildActivityWithdrawnEvent(
      submission({ status: SubmissionStatus.Withdrawn }),
    );
    expect(event.eventType).toBe(ACTIVITY_WITHDRAWN_EVENT);
    expect(event.payload.status).toBe(SubmissionStatus.Withdrawn);
    expect(JSON.stringify(event)).not.toContain('SECRET-NOTE');
  });
});
