import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  ID_GENERATOR_PORT,
  type IdGeneratorPort,
} from '@core/id-generator/id-generator.port';
import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { SecurityEventRepository } from '../infrastructure/security-event.repository';
import type { SecurityEventType } from '../model/identity.enums';

/**
 * Appends privacy-safe security-audit rows within the caller's transaction so
 * the audit trail commits atomically with the action it records. Callers pass
 * only ids/booleans — never emails, tokens, or password material.
 */
@Injectable()
export class SecurityAuditService {
  constructor(
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly events: SecurityEventRepository,
  ) {}

  async record(
    scope: TransactionScope,
    eventType: SecurityEventType,
    actorUserId: string | null,
    context: Readonly<Record<string, string | number | boolean>>,
  ): Promise<void> {
    await this.events.append(scope, {
      id: this.idGenerator.generate(),
      eventType,
      actorUserId,
      context,
      occurredAt: this.clock.now(),
    });
  }
}
