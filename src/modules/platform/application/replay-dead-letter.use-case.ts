import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { OutboxEventNotFoundError } from '../errors/outbox-event-not-found.error';
import { OutboxRepository } from '../infrastructure/outbox.repository';
import {
  AUDIT_OUTBOX_REPLAYED_ACTION,
  AUDIT_RESOURCE_OUTBOX_EVENT,
} from '../model/platform.constants';
import { AuditOutcome } from '../model/platform.enums';
import type {
  AuditInput,
  DomainEventEnvelope,
  ReplayResult,
} from '../model/platform.types';
import { AuditRecorderService } from './audit-recorder.service';

/**
 * Requeues a dead-lettered (or otherwise stuck) outbox event for another
 * dispatch, and records the privileged replay in the audit ledger — atomically.
 * Handlers are idempotent, so replaying a completed event is safe. Guarded by
 * `jobs.manage`. A forged/missing event id is a 404, never a silent success.
 */
@Injectable()
export class ReplayDeadLetterUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly outbox: OutboxRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(actor: AuthUserIdentity, eventId: string): Promise<ReplayResult> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, eventId),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    eventId: string,
  ): Promise<ReplayResult> {
    const event = await this.outbox.findById(scope, eventId);
    if (event === null) {
      throw new OutboxEventNotFoundError();
    }
    await this.outbox.requeue(scope, eventId, this.clock.now());
    await this.audit.record(scope, this.buildAudit(actor, event));
    return { eventId, requeued: true };
  }

  private buildAudit(
    actor: AuthUserIdentity,
    event: DomainEventEnvelope,
  ): AuditInput {
    return {
      actorUserId: actor.userId,
      action: AUDIT_OUTBOX_REPLAYED_ACTION,
      resourceType: AUDIT_RESOURCE_OUTBOX_EVENT,
      resourceId: event.eventId,
      teamId: event.teamId,
      seasonId: event.seasonId,
      correlationId: event.correlationId,
      outcome: AuditOutcome.Success,
      diff: { eventType: event.eventType },
    };
  }
}
