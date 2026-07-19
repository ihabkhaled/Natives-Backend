import type { AuthUserIdentity } from '@core/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ActivityBuddyConflictError } from '../errors/activity-buddy-conflict.error';
import { ActivityBuddyNotFoundError } from '../errors/activity-buddy-not-found.error';
import { BuddyDecision, BuddyStatus } from '../model/activity.enums';
import type { ActivityBuddy } from '../model/activity.types';
import { RespondToBuddyUseCase } from './respond-to-buddy.use-case';

const NOW = new Date('2024-06-01T00:00:00.000Z');
const ACTOR: AuthUserIdentity = {
  userId: 'u2',
  email: 'buddy@example.test',
  roles: [],
};

function buddy(status: BuddyStatus): ActivityBuddy {
  return {
    id: 'b1',
    submissionId: 's1',
    membershipId: 'm2',
    status,
    respondedAt: status === BuddyStatus.Pending ? null : NOW,
    respondedBy: status === BuddyStatus.Pending ? null : 'u2',
    createdAt: NOW,
  };
}

function build() {
  const tx = {} as never;
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(tx)),
  };
  const clock = { now: vi.fn().mockReturnValue(NOW) };
  const repository = {
    findOwnedForResponse: vi.fn().mockResolvedValue(buddy(BuddyStatus.Pending)),
    updateStatus: vi.fn().mockResolvedValue(buddy(BuddyStatus.Confirmed)),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const useCase = new RespondToBuddyUseCase(
    unitOfWork as never,
    clock as never,
    repository as never,
    audit as never,
  );
  return { repository, audit, useCase };
}

describe('RespondToBuddyUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('confirms a pending buddy credit', async () => {
    const view = await harness.useCase.execute(
      ACTOR,
      't1',
      'b1',
      BuddyDecision.Confirm,
    );
    expect(view.status).toBe(BuddyStatus.Confirmed);
    expect(harness.repository.updateStatus.mock.calls[0]?.[1]?.toStatus).toBe(
      BuddyStatus.Confirmed,
    );
    expect(harness.audit.record).toHaveBeenCalledOnce();
  });

  it('declines a pending buddy credit', async () => {
    harness.repository.updateStatus.mockResolvedValue(
      buddy(BuddyStatus.Declined),
    );
    const view = await harness.useCase.execute(
      ACTOR,
      't1',
      'b1',
      BuddyDecision.Decline,
    );
    expect(view.status).toBe(BuddyStatus.Declined);
  });

  it('hides a missing or out-of-scope credit as a 404', async () => {
    harness.repository.findOwnedForResponse.mockResolvedValue(null);
    await expect(
      harness.useCase.execute(ACTOR, 't1', 'bx', BuddyDecision.Confirm),
    ).rejects.toBeInstanceOf(ActivityBuddyNotFoundError);
  });

  it('rejects answering an already-resolved credit', async () => {
    harness.repository.findOwnedForResponse.mockResolvedValue(
      buddy(BuddyStatus.Confirmed),
    );
    await expect(
      harness.useCase.execute(ACTOR, 't1', 'b1', BuddyDecision.Confirm),
    ).rejects.toBeInstanceOf(ActivityBuddyConflictError);
  });

  it('rejects a lost race on the status update', async () => {
    harness.repository.updateStatus.mockResolvedValue(null);
    await expect(
      harness.useCase.execute(ACTOR, 't1', 'b1', BuddyDecision.Confirm),
    ).rejects.toBeInstanceOf(ActivityBuddyConflictError);
  });
});
