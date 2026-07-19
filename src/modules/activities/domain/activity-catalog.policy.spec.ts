import { describe, expect, it } from 'vitest';

import {
  ActivityCategory,
  ActivityTypeStatus,
  PointsApproval,
} from '../model/activity.enums';
import type { ActivityType } from '../model/activity.types';
import {
  isPointValueResolvable,
  nextCatalogVersion,
} from './activity-catalog.policy';

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
    catalogVersion: 3,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('activity-catalog.policy', () => {
  it('resolves an approved, present candidate point value', () => {
    expect(isPointValueResolvable(activityType())).toBe(true);
  });

  it('does not resolve a pending point value (WFDF/custom)', () => {
    expect(
      isPointValueResolvable(
        activityType({
          pointsApproval: PointsApproval.Pending,
          defaultPointValue: null,
        }),
      ),
    ).toBe(false);
  });

  it('does not resolve an approved but null point value', () => {
    expect(
      isPointValueResolvable(activityType({ defaultPointValue: null })),
    ).toBe(false);
  });

  it('does not resolve a pending yet non-null point value', () => {
    expect(
      isPointValueResolvable(
        activityType({ pointsApproval: PointsApproval.Pending }),
      ),
    ).toBe(false);
  });

  it('computes the next catalog version', () => {
    expect(nextCatalogVersion(3)).toBe(4);
  });
});
