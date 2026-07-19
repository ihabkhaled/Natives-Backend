import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ActivityTypeNotFoundError } from '../errors/activity-type-not-found.error';
import {
  ActivityCategory,
  ActivityTypeStatus,
  PointsApproval,
} from '../model/activity.enums';
import type { ActivityType } from '../model/activity.types';
import { ActivityCatalogService } from './activity-catalog.service';

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

function build() {
  const tx = {} as never;
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(tx)),
  };
  const scope = { validate: vi.fn().mockResolvedValue(undefined) };
  const repository = {
    listActive: vi.fn(),
    countActive: vi.fn(),
    findActiveById: vi.fn(),
  };
  const service = new ActivityCatalogService(
    unitOfWork as never,
    scope as never,
    repository,
  );
  return { tx, unitOfWork, scope, repository, service };
}

describe('ActivityCatalogService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('validates the team then lists active types as views', async () => {
    harness.repository.listActive.mockResolvedValue([TYPE]);
    harness.repository.countActive.mockResolvedValue(1);
    const page = await harness.service.listActiveTypes('t1', {
      limit: 20,
      offset: 0,
    });
    expect(harness.scope.validate).toHaveBeenCalledWith(harness.tx, 't1', null);
    expect(page.total).toBe(1);
    expect(page.items[0]?.typeKey).toBe('gym');
    expect('familyId' in (page.items[0] ?? {})).toBe(false);
  });

  it('requires an active type or throws', async () => {
    harness.repository.findActiveById.mockResolvedValueOnce(TYPE);
    await expect(
      harness.service.requireActiveType(harness.tx, 'type-1'),
    ).resolves.toBe(TYPE);

    harness.repository.findActiveById.mockResolvedValueOnce(null);
    await expect(
      harness.service.requireActiveType(harness.tx, 'type-x'),
    ).rejects.toBeInstanceOf(ActivityTypeNotFoundError);
  });
});
