import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityTypeRow } from '../model/activity.rows';
import { ActivityTypeRepository } from './activity-type.repository';

const ROW: ActivityTypeRow = {
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
  max_duration_minutes: null,
  status: 'active',
  catalog_version: 1,
  created_at: '2024-01-01T00:00:00.000Z',
};

function build() {
  const scope = { run: vi.fn() };
  return { scope, repository: new ActivityTypeRepository() };
}

describe('ActivityTypeRepository', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('lists active types with a bounded, ordered page', async () => {
    harness.scope.run.mockResolvedValueOnce([ROW]);
    const types = await harness.repository.listActive(harness.scope as never, {
      limit: 10,
      offset: 0,
    });
    expect(types).toHaveLength(1);
    expect(types[0]?.typeKey).toBe('gym');
    expect(String(harness.scope.run.mock.calls[0]?.[0])).toContain(
      `"status" = 'active'`,
    );
    expect(harness.scope.run.mock.calls[0]?.[1]).toEqual([10, 0]);
  });

  it('counts active types and defaults to zero', async () => {
    harness.scope.run.mockResolvedValueOnce([{ count: 9 }]);
    await expect(
      harness.repository.countActive(harness.scope as never),
    ).resolves.toBe(9);

    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.countActive(harness.scope as never),
    ).resolves.toBe(0);
  });

  it('finds an active type by id or returns null', async () => {
    harness.scope.run.mockResolvedValueOnce([ROW]);
    await expect(
      harness.repository.findActiveById(harness.scope as never, 'type-1'),
    ).resolves.toMatchObject({ id: 'type-1' });

    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.findActiveById(harness.scope as never, 'type-x'),
    ).resolves.toBeNull();
  });
});
