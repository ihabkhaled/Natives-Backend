import { beforeEach, describe, expect, it, vi } from 'vitest';

import { REDACTED_VALUE } from '../model/platform.constants';
import type { DomainEventInput } from '../model/platform.types';
import { RecordDomainEventService } from './record-domain-event.service';

const SCOPE = {} as never;
const NOW = new Date('2026-06-01T12:00:00.000Z');

function build() {
  const clock = { now: () => NOW, uptime: () => 0 };
  const idGenerator = { generate: vi.fn().mockReturnValue('ev-gen') };
  const outbox = { insert: vi.fn().mockResolvedValue(undefined) };
  const service = new RecordDomainEventService(
    clock,
    idGenerator,
    outbox as never,
  );
  return { service, outbox };
}

const INPUT: DomainEventInput = {
  aggregateType: 'membership',
  aggregateId: 'mem-1',
  eventType: 'member.invited',
  eventVersion: 1,
  actorUserId: 'admin-1',
  teamId: 'team-1',
  seasonId: null,
  correlationId: 'corr-1',
  causationId: null,
  payload: { membershipId: 'mem-1', phone: '+201234' },
};

describe('RecordDomainEventService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('persists a redacted, id-stamped envelope and returns it', async () => {
    const envelope = await harness.service.enqueue(SCOPE, INPUT);
    expect(envelope.eventId).toBe('ev-gen');
    expect(envelope.occurredAt).toBe(NOW);
    expect(envelope.payload).toEqual({
      membershipId: 'mem-1',
      phone: REDACTED_VALUE,
    });
    expect(harness.outbox.insert.mock.calls[0]?.[1]).toBe(envelope);
  });
});
