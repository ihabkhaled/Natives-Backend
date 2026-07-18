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

import { canReschedule } from '../domain/practice-session.state-machine';
import { InvalidSessionTimesError } from '../errors/invalid-session-times.error';
import { InvalidSessionTransitionError } from '../errors/invalid-session-transition.error';
import { OptimisticConflictError } from '../errors/optimistic-conflict.error';
import { PracticeSessionRepository } from '../infrastructure/practice-session.repository';
import { SessionStatusEventRepository } from '../infrastructure/session-status-event.repository';
import {
  PRACTICE_EVENT_VERSION,
  PRACTICE_RESCHEDULED_EVENT,
  SESSION_AGGREGATE_TYPE,
  SESSION_RESCHEDULED_ACTION,
  SESSION_RESOURCE_TYPE,
} from '../model/practices.constants';
import { SessionStatus } from '../model/practices.enums';
import type {
  NewStatusEvent,
  PracticeSession,
  RescheduleSessionCommand,
  SessionRescheduleWrite,
} from '../model/practices.types';
import { PracticeLookupService } from './practice-lookup.service';
import { ScopeValidationService } from './scope-validation.service';

/**
 * Moves a live session to new times and/or a new venue, marking it `rescheduled`
 * and announcing the change via a versioned `practice.rescheduled` outbox event
 * (which also carries a venue change). Only a published/rescheduled session may
 * move; the supplied end must not precede the start; a changed venue must belong
 * to the team. Optimistic concurrency guards the write; history is appended.
 */
@Injectable()
export class ReschedulePracticeSessionUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly lookup: PracticeLookupService,
    private readonly scopeValidation: ScopeValidationService,
    private readonly sessions: PracticeSessionRepository,
    private readonly statusEvents: SessionStatusEventRepository,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    command: RescheduleSessionCommand,
  ): Promise<PracticeSession> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, teamId, sessionId, command),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    command: RescheduleSessionCommand,
  ): Promise<PracticeSession> {
    const existing = await this.lookup.requireSession(scope, teamId, sessionId);
    if (existing.version !== command.expectedVersion) {
      throw new OptimisticConflictError();
    }
    if (!canReschedule(existing.status)) {
      throw new InvalidSessionTransitionError();
    }
    if (
      new Date(command.endsAt).getTime() < new Date(command.startsAt).getTime()
    ) {
      throw new InvalidSessionTimesError();
    }
    await this.scopeValidation.validateReferences(
      scope,
      teamId,
      null,
      command.venueId,
    );
    return this.applyReschedule(scope, actor, existing, command);
  }

  private async applyReschedule(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    existing: PracticeSession,
    command: RescheduleSessionCommand,
  ): Promise<PracticeSession> {
    const now = this.clock.now();
    const updated = await this.sessions.reschedule(
      scope,
      this.buildWrite(existing, command, actor, now),
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
    command: RescheduleSessionCommand,
    now: Date,
  ): Promise<void> {
    await this.statusEvents.append(
      scope,
      this.buildStatusEvent(existing, updated, command, actor, now),
    );
    await this.audit.record(scope, this.buildAudit(actor, updated));
    await this.events.enqueue(scope, this.buildDomainEvent(actor, updated));
  }

  private buildWrite(
    existing: PracticeSession,
    command: RescheduleSessionCommand,
    actor: AuthUserIdentity,
    now: Date,
  ): SessionRescheduleWrite {
    return {
      id: existing.id,
      teamId: existing.teamId,
      status: SessionStatus.Rescheduled,
      meetAt: command.meetAt === null ? null : new Date(command.meetAt),
      startsAt: new Date(command.startsAt),
      endsAt: new Date(command.endsAt),
      rsvpCutoffAt:
        command.rsvpCutoffAt === null ? null : new Date(command.rsvpCutoffAt),
      venueId: command.venueId,
      field: command.field,
      updatedBy: actor.userId,
      expectedVersion: command.expectedVersion,
      now,
    };
  }

  private buildStatusEvent(
    existing: PracticeSession,
    updated: PracticeSession,
    command: RescheduleSessionCommand,
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
    updated: PracticeSession,
  ): AuditInput {
    return {
      actorUserId: actor.userId,
      action: SESSION_RESCHEDULED_ACTION,
      resourceType: SESSION_RESOURCE_TYPE,
      resourceId: updated.id,
      teamId: updated.teamId,
      seasonId: updated.seasonId,
      correlationId: null,
      outcome: AuditOutcome.Success,
      diff: { startsAt: updated.startsAt.toISOString() },
    };
  }

  private buildDomainEvent(
    actor: AuthUserIdentity,
    updated: PracticeSession,
  ): DomainEventInput {
    return {
      aggregateType: SESSION_AGGREGATE_TYPE,
      aggregateId: updated.id,
      eventType: PRACTICE_RESCHEDULED_EVENT,
      eventVersion: PRACTICE_EVENT_VERSION,
      actorUserId: actor.userId,
      teamId: updated.teamId,
      seasonId: updated.seasonId,
      correlationId: null,
      causationId: null,
      payload: {
        startsAt: updated.startsAt.toISOString(),
        endsAt: updated.endsAt.toISOString(),
        venueId: updated.venueId,
      },
    };
  }
}
