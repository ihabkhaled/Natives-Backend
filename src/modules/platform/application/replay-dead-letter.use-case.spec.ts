import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OutboxEventNotFoundError } from '../errors/outbox-event-not-found.error';
import {
  AUDIT_OUTBOX_REPLAYED_ACTION,
  AUDIT_RESOURCE_OUTBOX_EVENT,
} from '../model/platform.constants';
import type { DomainEventEnvelope } from '../model/platform.types';
import { ReplayDeadLetterUseCase } from './replay-dead-letter.use-case';

const SCOPE = {} as never;
const NOW = new Date('2026-06-01T12:00:00.000Z');
const ACTOR = { userId: 'admin-1', email: 'a@example.test', roles: [] };

const EVENT: DomainEventEnvelope = {
  eventId: 'ev-1',
  aggregateType: 'membership',
  aggregateId: 'mem-1',
  eventType: 'member.invited',
  eventVersion: 1,
  actorUserId: 'user-1',
  teamId: 'team-1',
  seasonId: 'season-1',
  correlationId: 'corr-1',
  causationId: null,
  payload: {},
  occurredAt: NOW,
};

function build() {
  const clock = { now: () => NOW, uptime: () => 0 };
  const outbox = {
    findById: vi.fn().mockResolvedValue(EVENT),
    requeue: vi.fn().mockResolvedValue(true),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const useCase = new ReplayDeadLetterUseCase(
    unitOfWork as never,
    clock,
    outbox as never,
    audit as never,
  );
  return { useCase, outbox, audit };
}

describe('ReplayDeadLetterUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('requeues the event and records an audit entry', async () => {
    const result = await harness.useCase.execute(ACTOR, 'ev-1');
    expect(result).toEqual({ eventId: 'ev-1', requeued: true });
    expect(harness.outbox.requeue).toHaveBeenCalledWith(SCOPE, 'ev-1', NOW);
    expect(harness.audit.record.mock.calls[0]?.[1]).toMatchObject({
      actorUserId: 'admin-1',
      action: AUDIT_OUTBOX_REPLAYED_ACTION,
      resourceType: AUDIT_RESOURCE_OUTBOX_EVENT,
      resourceId: 'ev-1',
      teamId: 'team-1',
    });
  });

  it('raises 404 for a missing event id and does not requeue', async () => {
    harness.outbox.findById.mockResolvedValue(null);
    await expect(
      harness.useCase.execute(ACTOR, 'ghost'),
    ).rejects.toBeInstanceOf(OutboxEventNotFoundError);
    expect(harness.outbox.requeue).not.toHaveBeenCalled();
  });
});
