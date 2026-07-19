import type { AuthUserIdentity } from '@core/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ActivityDuplicateSubmissionError } from '../errors/activity-duplicate-submission.error';
import {
  ActivityCategory,
  ActivityTypeStatus,
  BuddyStatus,
  EvidenceKind,
  PointsApproval,
  SubmissionStatus,
} from '../model/activity.enums';
import type {
  ActivityBuddy,
  ActivitySubmission,
  ActivityType,
  CreateSubmissionCommand,
} from '../model/activity.types';
import { CreateSubmissionUseCase } from './create-submission.use-case';

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

const SUBMISSION: ActivitySubmission = {
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
  reviewerUserId: null,
  reviewStartedAt: null,
  reversalReason: null,
  reversedAt: null,
  reversedBy: null,
  withdrawnAt: null,
  createdBy: 'u1',
  createdAt: NOW,
  updatedAt: NOW,
};

const BUDDY: ActivityBuddy = {
  id: 'b1',
  submissionId: 's1',
  membershipId: 'm2',
  status: BuddyStatus.Pending,
  respondedAt: null,
  respondedBy: null,
  createdAt: NOW,
};

const COMMAND: CreateSubmissionCommand = {
  content: {
    activityTypeId: 'type-1',
    seasonId: null,
    performedOn: '2024-05-30',
    durationMinutes: 60,
    quantity: null,
    notes: null,
  },
  buddyMembershipIds: ['m2'],
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
  const scope = {
    validate: vi.fn().mockResolvedValue(undefined),
    resolveActingMembership: vi.fn().mockResolvedValue('m1'),
    requireBuddyMemberships: vi.fn().mockResolvedValue(undefined),
  };
  const catalog = { requireActiveType: vi.fn().mockResolvedValue(TYPE) };
  const submissions = {
    existsLiveForMember: vi.fn().mockResolvedValue(false),
    insert: vi.fn().mockResolvedValue(SUBMISSION),
  };
  const buddies = {
    insertMany: vi.fn().mockResolvedValue(undefined),
    listForSubmission: vi.fn().mockResolvedValue([BUDDY]),
  };
  const evidence = {
    insertMany: vi.fn().mockResolvedValue(undefined),
    countForSubmission: vi.fn().mockResolvedValue(0),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const useCase = new CreateSubmissionUseCase(
    unitOfWork as never,
    clock as never,
    idGenerator,
    scope as never,
    catalog as never,
    submissions as never,
    buddies as never,
    evidence as never,
    audit as never,
  );
  return { scope, catalog, submissions, buddies, evidence, audit, useCase };
}

describe('CreateSubmissionUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('creates a draft with pending buddies and a member-safe detail', async () => {
    const detail = await harness.useCase.execute(ACTOR, 't1', COMMAND);
    expect(harness.scope.resolveActingMembership).toHaveBeenCalledWith(
      expect.anything(),
      't1',
      'u1',
    );
    expect(detail.submission.id).toBe('s1');
    expect(detail.buddies).toHaveLength(1);
    const buddyRows = harness.buddies.insertMany.mock.calls[0]?.[1];
    expect(buddyRows[0].status).toBe(BuddyStatus.Pending);
    expect(harness.audit.record).toHaveBeenCalledOnce();
  });

  it('rejects a duplicate live claim', async () => {
    harness.submissions.existsLiveForMember.mockResolvedValue(true);
    await expect(
      harness.useCase.execute(ACTOR, 't1', COMMAND),
    ).rejects.toBeInstanceOf(ActivityDuplicateSubmissionError);
    expect(harness.submissions.insert).not.toHaveBeenCalled();
  });
});
