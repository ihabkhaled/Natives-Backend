import type { AuthUserIdentity } from '@core/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PointsAdjustmentConflictError } from '../errors/points-adjustment-conflict.error';
import type { AdjustmentCommand } from '../model/points.types';
import { CreateAdjustmentUseCase } from './create-adjustment.use-case';

const ACTOR: AuthUserIdentity = {
  userId: 'admin',
  email: 'a@x.test',
  roles: [],
};
const COMMAND: AdjustmentCommand = {
  amount: -5,
  reason: 'duplicate credit removed',
  operationKey: 'op-123456',
};

function build() {
  const tx = {} as never;
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(tx)),
  };
  const clock = {
    now: vi.fn().mockReturnValue(new Date('2026-02-01T00:00:00Z')),
  };
  const idGenerator = { generate: vi.fn().mockReturnValue('entry-1') };
  const scope = {
    validate: vi.fn().mockResolvedValue(undefined),
    requireMembership: vi.fn().mockResolvedValue(undefined),
  };
  const ledger = {
    insert: vi.fn().mockResolvedValue({ id: 'entry-1', teamId: 'team-1' }),
  };
  const badges = { sync: vi.fn().mockResolvedValue(undefined) };
  const summary = {
    assemble: vi.fn().mockResolvedValue({ membershipId: 'mem-1', total: -5 }),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const events = { enqueue: vi.fn().mockResolvedValue(undefined) };
  const useCase = new CreateAdjustmentUseCase(
    unitOfWork as never,
    clock as never,
    idGenerator,
    scope as never,
    ledger as never,
    badges as never,
    summary as never,
    audit as never,
    events as never,
  );
  return { scope, ledger, badges, summary, audit, events, useCase };
}

describe('CreateAdjustmentUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('appends an audited, idempotent adjustment and returns the fresh summary', async () => {
    const result = await harness.useCase.execute(
      ACTOR,
      'team-1',
      'mem-1',
      COMMAND,
    );
    expect(harness.scope.validate).toHaveBeenCalledOnce();
    const entry = harness.ledger.insert.mock.calls[0]?.[1];
    expect(entry).toMatchObject({
      amount: -5,
      reason: 'duplicate credit removed',
      idempotencyKey: 'adjust:mem-1:op-123456',
    });
    expect(harness.badges.sync).toHaveBeenCalledOnce();
    expect(harness.audit.record).toHaveBeenCalledOnce();
    expect(harness.events.enqueue).toHaveBeenCalledOnce();
    expect(result.total).toBe(-5);
  });

  it('rejects a duplicate operation key with a 409', async () => {
    harness.ledger.insert.mockResolvedValue(null);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', 'mem-1', COMMAND),
    ).rejects.toBeInstanceOf(PointsAdjustmentConflictError);
    expect(harness.summary.assemble).not.toHaveBeenCalled();
  });
});
