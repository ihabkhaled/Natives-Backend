import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
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

import { OptimisticConflictError } from '../errors/optimistic-conflict.error';
import { PracticeSessionRepository } from '../infrastructure/practice-session.repository';
import {
  PRACTICE_EVENT_VERSION,
  PRACTICE_VENUE_CHANGED_EVENT,
  SESSION_AGGREGATE_TYPE,
  SESSION_RESOURCE_TYPE,
  SESSION_UPDATED_ACTION,
} from '../model/practices.constants';
import { SessionStatus } from '../model/practices.enums';
import type {
  PracticeSession,
  SessionDetailsUpdate,
  UpdateSessionCommand,
} from '../model/practices.types';
import { PracticeLookupService } from './practice-lookup.service';
import { ScopeValidationService } from './scope-validation.service';

/**
 * Updates a session's presentation details (venue, field, capacity, notes,
 * visibility) under optimistic concurrency. Times are moved only through the
 * reschedule flow; this never changes the schedule instant. A changed venue must
 * belong to the team. Missing/cross-team resolves to not-found; a stale version
 * raises a conflict.
 */
@Injectable()
export class UpdatePracticeSessionUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly lookup: PracticeLookupService,
    private readonly scopeValidation: ScopeValidationService,
    private readonly sessions: PracticeSessionRepository,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    command: UpdateSessionCommand,
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
    command: UpdateSessionCommand,
  ): Promise<PracticeSession> {
    const existing = await this.lookup.requireSession(scope, teamId, sessionId);
    if (existing.version !== command.expectedVersion) {
      throw new OptimisticConflictError();
    }
    await this.scopeValidation.validateReferences(
      scope,
      teamId,
      null,
      command.venueId,
    );
    return this.applyUpdate(scope, actor, existing, teamId, sessionId, command);
  }

  private async applyUpdate(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    existing: PracticeSession,
    teamId: string,
    sessionId: string,
    command: UpdateSessionCommand,
  ): Promise<PracticeSession> {
    const updated = await this.sessions.updateDetails(
      scope,
      this.buildUpdate(teamId, sessionId, command, actor),
    );
    if (updated === null) {
      throw new OptimisticConflictError();
    }
    await this.audit.record(scope, this.buildAudit(actor, updated));
    await this.recordVenueChange(scope, actor, existing, updated);
    return updated;
  }

  private async recordVenueChange(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    existing: PracticeSession,
    updated: PracticeSession,
  ): Promise<void> {
    if (!this.isVisibleVenueChange(existing, updated)) {
      return;
    }
    await this.events.enqueue(scope, this.buildVenueEvent(actor, updated));
  }

  private isVisibleVenueChange(
    existing: PracticeSession,
    updated: PracticeSession,
  ): boolean {
    const visible =
      existing.status === SessionStatus.Published ||
      existing.status === SessionStatus.Rescheduled;
    return (
      visible &&
      (existing.venueId !== updated.venueId || existing.field !== updated.field)
    );
  }

  private buildVenueEvent(
    actor: AuthUserIdentity,
    session: PracticeSession,
  ): DomainEventInput {
    return {
      aggregateType: SESSION_AGGREGATE_TYPE,
      aggregateId: session.id,
      eventType: PRACTICE_VENUE_CHANGED_EVENT,
      eventVersion: PRACTICE_EVENT_VERSION,
      actorUserId: actor.userId,
      teamId: session.teamId,
      seasonId: session.seasonId,
      correlationId: null,
      causationId: null,
      payload: { venueId: session.venueId, field: session.field },
    };
  }

  private buildUpdate(
    teamId: string,
    sessionId: string,
    command: UpdateSessionCommand,
    actor: AuthUserIdentity,
  ): SessionDetailsUpdate {
    return {
      id: sessionId,
      teamId,
      venueId: command.venueId,
      field: command.field,
      capacity: command.capacity,
      notes: command.notes,
      visibility: command.visibility,
      updatedBy: actor.userId,
      expectedVersion: command.expectedVersion,
      now: this.clock.now(),
    };
  }

  private buildAudit(
    actor: AuthUserIdentity,
    session: PracticeSession,
  ): AuditInput {
    return {
      actorUserId: actor.userId,
      action: SESSION_UPDATED_ACTION,
      resourceType: SESSION_RESOURCE_TYPE,
      resourceId: session.id,
      teamId: session.teamId,
      seasonId: session.seasonId,
      correlationId: null,
      outcome: AuditOutcome.Success,
      diff: { version: session.version },
    };
  }
}
