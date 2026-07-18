import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  ID_GENERATOR_PORT,
  type IdGeneratorPort,
} from '@core/id-generator/id-generator.port';
import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { buildEventEnvelope } from '../domain/event-envelope.factory';
import { OutboxRepository } from '../infrastructure/outbox.repository';
import type {
  DomainEventEnvelope,
  DomainEventInput,
} from '../model/platform.types';

/**
 * The reusable domain-event primitive. Builds a versioned, redacted envelope and
 * persists it to the outbox inside the caller's transaction, so the event and the
 * state change it describes commit atomically. Returns the envelope so the caller
 * can chain a causation id.
 */
@Injectable()
export class RecordDomainEventService {
  constructor(
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly outbox: OutboxRepository,
  ) {}

  async enqueue(
    scope: TransactionScope,
    input: DomainEventInput,
  ): Promise<DomainEventEnvelope> {
    const envelope = buildEventEnvelope(
      input,
      this.idGenerator.generate(),
      this.clock.now(),
    );
    await this.outbox.insert(scope, envelope);
    return envelope;
  }
}
