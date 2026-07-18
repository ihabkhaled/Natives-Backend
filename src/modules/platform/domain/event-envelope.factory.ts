import type {
  DomainEventEnvelope,
  DomainEventInput,
} from '../model/platform.types';
import { redactScalarPayload } from './redaction.policy';

/**
 * Pure factory for the versioned domain-event envelope. Assigns the generated
 * event id and the resolved occurrence instant, and redacts the payload so no
 * sensitive scalar reaches the outbox. No side effects, no clock, no persistence.
 */
export function buildEventEnvelope(
  input: DomainEventInput,
  eventId: string,
  occurredAt: Date,
): DomainEventEnvelope {
  return {
    eventId,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    eventType: input.eventType,
    eventVersion: input.eventVersion,
    actorUserId: input.actorUserId,
    teamId: input.teamId,
    seasonId: input.seasonId,
    correlationId: input.correlationId,
    causationId: input.causationId,
    payload: redactScalarPayload(input.payload),
    occurredAt,
  };
}
