import { describe, expect, it } from 'vitest';

import { REDACTED_VALUE } from '../model/platform.constants';
import type { DomainEventInput } from '../model/platform.types';
import { buildEventEnvelope } from './event-envelope.factory';

const NOW = new Date('2026-06-01T12:00:00.000Z');

function input(overrides: Partial<DomainEventInput> = {}): DomainEventInput {
  return {
    aggregateType: 'membership',
    aggregateId: 'mem-1',
    eventType: 'member.invited',
    eventVersion: 1,
    actorUserId: 'admin-1',
    teamId: 'team-1',
    seasonId: null,
    correlationId: 'corr-1',
    causationId: null,
    payload: { membershipId: 'mem-1', email: 'a@example.test' },
    ...overrides,
  };
}

describe('buildEventEnvelope', () => {
  it('assigns the id + instant and redacts the payload', () => {
    const envelope = buildEventEnvelope(input(), 'ev-1', NOW);
    expect(envelope.eventId).toBe('ev-1');
    expect(envelope.occurredAt).toBe(NOW);
    expect(envelope.eventVersion).toBe(1);
    expect(envelope.payload).toEqual({
      membershipId: 'mem-1',
      email: REDACTED_VALUE,
    });
  });

  it('preserves aggregate identity, scope, correlation, and causation', () => {
    const envelope = buildEventEnvelope(
      input({ causationId: 'cause-1', seasonId: 'season-1' }),
      'ev-2',
      NOW,
    );
    expect(envelope.aggregateType).toBe('membership');
    expect(envelope.aggregateId).toBe('mem-1');
    expect(envelope.teamId).toBe('team-1');
    expect(envelope.seasonId).toBe('season-1');
    expect(envelope.correlationId).toBe('corr-1');
    expect(envelope.causationId).toBe('cause-1');
  });
});
