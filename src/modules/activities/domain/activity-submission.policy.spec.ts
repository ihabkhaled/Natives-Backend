import { describe, expect, it } from 'vitest';

import { ActivityValidationError } from '../errors/activity-validation.error';
import {
  ActivityCategory,
  ActivityTypeStatus,
  PointsApproval,
  SubmissionStatus,
} from '../model/activity.enums';
import type {
  ActivitySubmission,
  ActivityType,
  SubmissionContent,
} from '../model/activity.types';
import {
  assertSubmissionContent,
  isSubmissionOwnedBy,
} from './activity-submission.policy';

const TODAY = '2024-06-01';

function activityType(overrides: Partial<ActivityType> = {}): ActivityType {
  return {
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
    ...overrides,
  };
}

function content(
  overrides: Partial<SubmissionContent> = {},
): SubmissionContent {
  return {
    activityTypeId: 'type-1',
    seasonId: null,
    performedOn: '2024-05-30',
    durationMinutes: 60,
    quantity: null,
    notes: null,
    ...overrides,
  };
}

function submission(userId: string): ActivitySubmission {
  return {
    id: 's1',
    teamId: 't1',
    seasonId: null,
    membershipId: 'm1',
    activityTypeId: 'type-1',
    submitterUserId: userId,
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
    createdBy: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('activity-submission.policy', () => {
  it('recognises ownership by the submitter user id', () => {
    expect(isSubmissionOwnedBy(submission('u1'), 'u1')).toBe(true);
    expect(isSubmissionOwnedBy(submission('u1'), 'u2')).toBe(false);
  });

  it('accepts valid content within bounds', () => {
    expect(() =>
      assertSubmissionContent(content(), activityType(), TODAY),
    ).not.toThrow();
  });

  it('accepts a null (unmeasured) duration', () => {
    expect(() =>
      assertSubmissionContent(
        content({ durationMinutes: null }),
        activityType(),
        TODAY,
      ),
    ).not.toThrow();
  });

  it('rejects a malformed performed date', () => {
    expect(() =>
      assertSubmissionContent(
        content({ performedOn: '2024/05/30' }),
        activityType(),
        TODAY,
      ),
    ).toThrow(ActivityValidationError);
  });

  it('rejects an impossible calendar date', () => {
    expect(() =>
      assertSubmissionContent(
        content({ performedOn: '2024-02-30' }),
        activityType(),
        TODAY,
      ),
    ).toThrow(ActivityValidationError);
  });

  it('rejects a future performed date', () => {
    expect(() =>
      assertSubmissionContent(
        content({ performedOn: '2024-06-02' }),
        activityType(),
        TODAY,
      ),
    ).toThrow(ActivityValidationError);
  });

  it('rejects a non-integer or non-positive duration', () => {
    expect(() =>
      assertSubmissionContent(
        content({ durationMinutes: 12.5 }),
        activityType(),
        TODAY,
      ),
    ).toThrow(ActivityValidationError);
    expect(() =>
      assertSubmissionContent(
        content({ durationMinutes: 0 }),
        activityType(),
        TODAY,
      ),
    ).toThrow(ActivityValidationError);
  });

  it('enforces the activity type duration bounds', () => {
    const bounded = activityType({
      minDurationMinutes: 30,
      maxDurationMinutes: 120,
    });
    expect(() =>
      assertSubmissionContent(content({ durationMinutes: 20 }), bounded, TODAY),
    ).toThrow(ActivityValidationError);
    expect(() =>
      assertSubmissionContent(
        content({ durationMinutes: 200 }),
        bounded,
        TODAY,
      ),
    ).toThrow(ActivityValidationError);
    expect(() =>
      assertSubmissionContent(content({ durationMinutes: 60 }), bounded, TODAY),
    ).not.toThrow();
  });

  it('rejects over-long notes', () => {
    expect(() =>
      assertSubmissionContent(
        content({ notes: 'x'.repeat(4001) }),
        activityType(),
        TODAY,
      ),
    ).toThrow(ActivityValidationError);
  });
});
