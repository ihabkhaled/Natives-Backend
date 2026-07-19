import type { AuthUserIdentity } from '@core/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ActivityDuplicateSubmissionError } from '../errors/activity-duplicate-submission.error';
import { ActivityInvalidTransitionError } from '../errors/activity-invalid-transition.error';
import { ActivityVersionConflictError } from '../errors/activity-version-conflict.error';
import {
  ActivityCategory,
  ActivityTypeStatus,
  EvidenceKind,
  PointsApproval,
  SubmissionStatus,
} from '../model/activity.enums';
import type {
  ActivitySubmission,
  ActivityType,
  UpdateSubmissionCommand,
} from '../model/activity.types';
import { UpdateSubmissionUseCase } from './update-submission.use-case';

const NOW = new Date('2024-06-01T00:00:00.000Z');
const ACTOR: AuthUserIdentity = {
  userId: 'u1',
  email: 'p@example.test',
  roles: [],
};

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
  createdAt: NOW,
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
    status: SubmissionStatus.Draft,
    performedOn: '2024-05-30',
    durationMinutes: 60,
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
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

const COMMAND: UpdateSubmissionCommand = {
  expectedRecordVersion: 1,
  content: {
    activityTypeId: 'type-1',
    seasonId: null,
    performedOn: '2024-05-30',
    durationMinutes: 45,
    quantity: null,
    notes: 'updated',
  },
  evidence: [
    {
      kind: EvidenceKind.Link,
      storageReference: 'private/ref',
      contentType: null,
      byteSize: null,
      description: null,
    },
  ],
};

function build() {
  const tx = {} as never;
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(tx)),
  };
  const clock = { now: vi.fn().mockReturnValue(NOW) };
  const idGenerator = { generate: vi.fn().mockReturnValue('gen-id') };
  const scope = { validate: vi.fn().mockResolvedValue(undefined) };
  const catalog = { requireActiveType: vi.fn().mockResolvedValue(TYPE) };
  const lookup = {
    requireForWrite: vi.fn().mockResolvedValue(submission()),
    requireOwner: vi.fn(),
  };
  const submissions = {
    existsLiveForMember: vi.fn().mockResolvedValue(false),
    updateContent: vi.fn().mockResolvedValue(submission({ recordVersion: 2 })),
  };
  const buddies = { listForSubmission: vi.fn().mockResolvedValue([]) };
  const evidence = {
    clearForSubmission: vi.fn().mockResolvedValue(undefined),
    insertMany: vi.fn().mockResolvedValue(undefined),
    countForSubmission: vi.fn().mockResolvedValue(0),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const useCase = new UpdateSubmissionUseCase(
    unitOfWork as never,
    clock as never,
    idGenerator,
    scope as never,
    catalog as never,
    lookup as never,
    submissions as never,
    buddies as never,
    evidence as never,
    audit as never,
  );
  return { lookup, submissions, evidence, audit, useCase };
}

describe('UpdateSubmissionUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('replaces content and evidence on an editable submission', async () => {
    const detail = await harness.useCase.execute(ACTOR, 't1', 's1', COMMAND);
    expect(detail.submission.recordVersion).toBe(2);
    expect(harness.evidence.clearForSubmission).toHaveBeenCalledOnce();
    expect(harness.audit.record).toHaveBeenCalledOnce();
  });

  it('rejects editing a locked submission', async () => {
    harness.lookup.requireForWrite.mockResolvedValue(
      submission({ status: SubmissionStatus.Submitted }),
    );
    await expect(
      harness.useCase.execute(ACTOR, 't1', 's1', COMMAND),
    ).rejects.toBeInstanceOf(ActivityInvalidTransitionError);
  });

  it('rejects a duplicate live claim on update', async () => {
    harness.submissions.existsLiveForMember.mockResolvedValue(true);
    await expect(
      harness.useCase.execute(ACTOR, 't1', 's1', COMMAND),
    ).rejects.toBeInstanceOf(ActivityDuplicateSubmissionError);
  });

  it('rejects a stale version', async () => {
    harness.submissions.updateContent.mockResolvedValue(null);
    await expect(
      harness.useCase.execute(ACTOR, 't1', 's1', COMMAND),
    ).rejects.toBeInstanceOf(ActivityVersionConflictError);
  });
});
