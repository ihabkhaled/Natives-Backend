import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OutboxStatus } from '../model/platform.enums';
import type { LeasedEvent } from '../model/platform.types';
import { ProcessOutboxBatchUseCase } from './process-outbox-batch.use-case';

const SCOPE = {} as never;
const NOW = new Date('2026-06-01T12:00:00.000Z');

function leased(attempts: number): LeasedEvent {
  return {
    envelope: {
      eventId: 'ev-1',
      aggregateType: 'membership',
      aggregateId: 'mem-1',
      eventType: 'member.invited',
      eventVersion: 1,
      actorUserId: 'user-1',
      teamId: 'team-1',
      seasonId: null,
      correlationId: null,
      causationId: null,
      payload: {},
      occurredAt: NOW,
    },
    status: OutboxStatus.Processing,
    attempts,
  };
}

function build() {
  const clock = { now: () => NOW, uptime: () => 0 };
  const handler = { handle: vi.fn().mockResolvedValue(undefined) };
  const outbox = {
    leaseBatch: vi.fn().mockResolvedValue([]),
    markCompleted: vi.fn().mockResolvedValue(undefined),
    reschedule: vi.fn().mockResolvedValue(undefined),
    deadLetter: vi.fn().mockResolvedValue(undefined),
  };
  const logger = { setContext: vi.fn(), warn: vi.fn() };
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const useCase = new ProcessOutboxBatchUseCase(
    unitOfWork as never,
    clock,
    handler,
    outbox as never,
    logger as never,
  );
  return { useCase, handler, outbox, logger };
}

describe('ProcessOutboxBatchUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('returns an empty summary when nothing is due', async () => {
    const result = await harness.useCase.execute();
    expect(result).toEqual({
      leased: 0,
      completed: 0,
      retried: 0,
      deadLettered: 0,
    });
    expect(harness.handler.handle).not.toHaveBeenCalled();
  });

  it('dispatches and completes a leased event', async () => {
    harness.outbox.leaseBatch.mockResolvedValue([leased(1)]);
    const result = await harness.useCase.execute();
    expect(harness.handler.handle).toHaveBeenCalledWith(
      SCOPE,
      leased(1).envelope,
    );
    expect(harness.outbox.markCompleted).toHaveBeenCalledWith(
      SCOPE,
      'ev-1',
      NOW,
    );
    expect(result.completed).toBe(1);
  });

  it('reschedules a failing event below the attempt ceiling', async () => {
    harness.outbox.leaseBatch.mockResolvedValue([leased(2)]);
    harness.handler.handle.mockRejectedValue(new Error('boom'));
    const result = await harness.useCase.execute();
    expect(harness.outbox.reschedule).toHaveBeenCalled();
    expect(harness.outbox.deadLetter).not.toHaveBeenCalled();
    expect(result.retried).toBe(1);
  });

  it('dead-letters a failing event at the attempt ceiling', async () => {
    harness.outbox.leaseBatch.mockResolvedValue([leased(5)]);
    harness.handler.handle.mockRejectedValue('non-error');
    const result = await harness.useCase.execute();
    expect(harness.outbox.deadLetter).toHaveBeenCalledWith(
      SCOPE,
      'ev-1',
      'non-error',
      NOW,
    );
    expect(result.deadLettered).toBe(1);
  });
});
