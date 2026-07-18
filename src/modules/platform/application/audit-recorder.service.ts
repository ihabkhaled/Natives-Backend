import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  ID_GENERATOR_PORT,
  type IdGeneratorPort,
} from '@core/id-generator/id-generator.port';
import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { redactScalarPayload } from '../domain/redaction.policy';
import { AuditLogRepository } from '../infrastructure/audit-log.repository';
import type { AuditInput, NewAuditEntry } from '../model/platform.types';

/**
 * The reusable audit primitive other modules call from inside their business
 * transaction. Redacts the diff, stamps the id + occurrence instant from the
 * ports, and appends one immutable row — so audit evidence commits atomically
 * with the change it records.
 */
@Injectable()
export class AuditRecorderService {
  constructor(
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly repository: AuditLogRepository,
  ) {}

  record(scope: TransactionScope, input: AuditInput): Promise<void> {
    return this.repository.append(scope, this.build(input));
  }

  private build(input: AuditInput): NewAuditEntry {
    return {
      ...input,
      diff: redactScalarPayload(input.diff),
      id: this.idGenerator.generate(),
      occurredAt: this.clock.now(),
    };
  }
}
