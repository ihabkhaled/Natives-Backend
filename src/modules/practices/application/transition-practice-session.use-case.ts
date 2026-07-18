import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  ID_GENERATOR_PORT,
  type IdGeneratorPort,
} from '@core/id-generator/id-generator.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import {
  type AuditInput,
  AuditOutcome,
  AuditRecorderService,
  type DomainEventInput,
  RecordDomainEventService,
} from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { canTransition } from '../domain/practice-session.state-machine';
import { InvalidSessionTransitionError } from '../errors/invalid-session-transition.error';
import { OptimisticConflictError } from '../errors/optimistic-conflict.error';
import { PracticeSessionRepository } from '../infrastructure/practice-session.repository';
import { SessionStatusEventRepository } from '../infrastructure/session-status-event.repository';
import {
  PRACTICE_CANCELLED_EVENT,
  PRACTICE_EVENT_VERSION,
  PRACTICE_PUBLISHED_EVENT,
  SESSION_AGGREGATE_TYPE,
  SESSION_RESOURCE_TYPE,
  SESSION_TRANSITIONED_ACTION,
} from '../model/practices.constants';
import { SessionStatus } from '../model/practices.enums';
import type {
  NewStatusEvent,
  PracticeSession,
  SessionStatusChange,
  SessionStatusCommand,
} from '../model/practices.types';
import { PracticeLookupService } from './practice-lookup.service';

/**
 * Applies a status transition (publish / cancel / re-open) to a session under
 * optimistic concurrency. The move is validated by the pure state machine;
 * cancelling records a reason and NEVER deletes RSVP/attendance history; re-open
 * clears the cancellation reason. Each transition appends an immutable
 * status-history row, an audit row, and — for publish/cancel — a versioned domain
 * event to the transactional outbox, all in one transaction.
 */
@Injectable()
export class TransitionPracticeSessionUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly lookup: PracticeLookupService,
    private readonly sessions: PracticeSessionRepository,
    private readonly statusEvents: SessionStatusEventRepository,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    targetStatus: SessionStatus,
    command: SessionStatusCommand,
  ): Promise<PracticeSession> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, teamId, sessionId, targetStatus, command),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    targetStatus: SessionStatus,
    command: SessionStatusCommand,
  ): Promise<PracticeSession> {
    const existing = await this.lookup.requireSession(scope, teamId, sessionId);
    if (existing.version !== command.expectedVersion) {
      throw new OptimisticConflictError();
    }
    if (!canTransition(existing.status, targetStatus)) {
      throw new InvalidSessionTransitionError();
    }
    return this.applyTransition(scope, actor, existing, targetStatus, command);
  }

  private async applyTransition(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    existing: PracticeSession,
    targetStatus: SessionStatus,
    command: SessionStatusCommand,
  ): Promise<PracticeSession> {
    const now = this.clock.now();
    const updated = await this.sessions.applyStatusChange(
      scope,
      this.buildChange(existing, targetStatus, command, actor, now),
    );
    if (updated === null) {
      throw new OptimisticConflictError();
    }
    await this.record(scope, actor, existing, updated, command, now);
    return updated;
  }

  private async record(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    existing: PracticeSession,
    updated: PracticeSession,
    command: SessionStatusCommand,
    now: Date,
  ): Promise<void> {
    await this.statusEvents.append(
      scope,
      this.buildStatusEvent(existing, updated, command, actor, now),
    );
    await this.audit.record(scope, this.buildAudit(actor, existing, updated));
    await this.maybeEmit(scope, actor, updated);
  }

  private async maybeEmit(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    updated: PracticeSession,
  ): Promise<void> {
    const eventType = this.resolveEventType(updated.status);
    if (eventType !== null) {
      await this.events.enqueue(
        scope,
        this.buildDomainEvent(actor, updated, eventType),
      );
    }
  }

  private resolveEventType(status: SessionStatus): string | null {
    if (status === SessionStatus.Published) {
      return PRACTICE_PUBLISHED_EVENT;
    }
    if (status === SessionStatus.Cancelled) {
      return PRACTICE_CANCELLED_EVENT;
    }
    return null;
  }

  private buildChange(
    existing: PracticeSession,
    targetStatus: SessionStatus,
    command: SessionStatusCommand,
    actor: AuthUserIdentity,
    now: Date,
  ): SessionStatusChange {
    return {
      id: existing.id,
      teamId: existing.teamId,
      status: targetStatus,
      cancellationReason:
        targetStatus === SessionStatus.Cancelled ? command.reason : null,
      updatedBy: actor.userId,
      expectedVersion: existing.version,
      now,
    };
  }

  private buildStatusEvent(
    existing: PracticeSession,
    updated: PracticeSession,
    command: SessionStatusCommand,
    actor: AuthUserIdentity,
    now: Date,
  ): NewStatusEvent {
    return {
      id: this.idGenerator.generate(),
      sessionId: updated.id,
      fromStatus: existing.status,
      toStatus: updated.status,
      reason: command.reason,
      actorUserId: actor.userId,
      now,
    };
  }

  private buildAudit(
    actor: AuthUserIdentity,
    existing: PracticeSession,
    updated: PracticeSession,
  ): AuditInput {
    return {
      actorUserId: actor.userId,
      action: SESSION_TRANSITIONED_ACTION,
      resourceType: SESSION_RESOURCE_TYPE,
      resourceId: updated.id,
      teamId: updated.teamId,
      seasonId: updated.seasonId,
      correlationId: null,
      outcome: AuditOutcome.Success,
      diff: { from: existing.status, to: updated.status },
    };
  }

  private buildDomainEvent(
    actor: AuthUserIdentity,
    updated: PracticeSession,
    eventType: string,
  ): DomainEventInput {
    return {
      aggregateType: SESSION_AGGREGATE_TYPE,
      aggregateId: updated.id,
      eventType,
      eventVersion: PRACTICE_EVENT_VERSION,
      actorUserId: actor.userId,
      teamId: updated.teamId,
      seasonId: updated.seasonId,
      correlationId: null,
      causationId: null,
      payload: {
        status: updated.status,
        startsAt: updated.startsAt.toISOString(),
        venueId: updated.venueId,
      },
    };
  }
}
