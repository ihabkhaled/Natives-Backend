import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DevelopmentGoalNotFoundError } from '../errors/development-goal-not-found.error';
import { GoalLookupService } from './goal-lookup.service';

function build() {
  const repository = { findForWrite: vi.fn() };
  return {
    repository,
    service: new GoalLookupService(repository as never),
    tx: {} as never,
  };
}

describe('GoalLookupService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('returns a found goal for write', async () => {
    harness.repository.findForWrite.mockResolvedValue({ id: 'goal-1' });
    await expect(
      harness.service.requireForWrite(harness.tx, 'team-1', 'goal-1'),
    ).resolves.not.toBeNull();
  });

  it('hides a missing or soft-deleted goal as not-found', async () => {
    harness.repository.findForWrite.mockResolvedValue(null);
    await expect(
      harness.service.requireForWrite(harness.tx, 'team-1', 'goal-x'),
    ).rejects.toBeInstanceOf(DevelopmentGoalNotFoundError);
  });
});
