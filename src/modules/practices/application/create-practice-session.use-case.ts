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
} from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { InvalidSessionTimesError } from '../errors/invalid-session-times.error';
import { PracticeSessionRepository } from '../infrastructure/practice-session.repository';
import { SessionStatusEventRepository } from '../infrastructure/session-status-event.repository';
import {
  DEFAULT_TIMEZONE,
  SESSION_CREATED_ACTION,
  SESSION_RESOURCE_TYPE,
} from '../model/practices.constants';
import { SessionStatus, SessionVisibility } from '../model/practices.enums';
import type {
  CreateSessionCommand,
  NewSession,
  NewStatusEvent,
  PracticeSession,
} from '../model/practices.types';
import { ScopeValidationService } from './scope-validation.service';

/**
 * Creates a stand-alone (one-off) practice session — a session with no owning
 * schedule. It starts as a draft; publishing announces it. Validates the target
 * scope and that the supplied end is not before the start. Persists the session,
 * an initial status-history row, and an audit row in one transaction.
 */
@Injectable()
export class CreatePracticeSessionUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly scopeValidation: ScopeValidationService,
    private readonly sessions: PracticeSessionRepository,
    private readonly statusEvents: SessionStatusEventRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateSessionCommand,
  ): Promise<PracticeSession> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, teamId, command),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateSessionCommand,
  ): Promise<PracticeSession> {
    const startsAt = new Date(command.startsAt);
    const endsAt = new Date(command.endsAt);
    if (endsAt.getTime() < startsAt.getTime()) {
      throw new InvalidSessionTimesError();
    }
    await this.scopeValidation.validate(
      scope,
      teamId,
      command.seasonId,
      command.venueId,
    );
    const now = this.clock.now();
    const session = await this.sessions.insert(
      scope,
      this.buildSession(teamId, command, actor, startsAt, endsAt, now),
    );
    await this.recordCreation(scope, actor, session, now);
    return session;
  }

  private async recordCreation(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    session: PracticeSession,
    now: Date,
  ): Promise<void> {
    await this.statusEvents.append(scope, this.buildEvent(actor, session, now));
    await this.audit.record(scope, this.buildAudit(actor, session));
  }

  private buildSession(
    teamId: string,
    command: CreateSessionCommand,
    actor: AuthUserIdentity,
    startsAt: Date,
    endsAt: Date,
    now: Date,
  ): NewSession {
    return {
      id: this.idGenerator.generate(),
      teamId,
      seasonId: command.seasonId,
      scheduleId: null,
      occurrenceDate: null,
      sessionType: command.sessionType,
      timezone: command.timezone ?? DEFAULT_TIMEZONE,
      venueId: command.venueId,
      field: command.field,
      capacity: command.capacity,
      meetAt: command.meetAt === null ? null : new Date(command.meetAt),
      startsAt,
      endsAt,
      rsvpCutoffAt:
        command.rsvpCutoffAt === null ? null : new Date(command.rsvpCutoffAt),
      visibility: command.visibility ?? SessionVisibility.Team,
      organizerUserId: command.organizerUserId,
      notes: command.notes,
      status: SessionStatus.Draft,
      createdBy: actor.userId,
      now,
    };
  }

  private buildEvent(
    actor: AuthUserIdentity,
    session: PracticeSession,
    now: Date,
  ): NewStatusEvent {
    return {
      id: this.idGenerator.generate(),
      sessionId: session.id,
      fromStatus: null,
      toStatus: session.status,
      reason: null,
      actorUserId: actor.userId,
      now,
    };
  }

  private buildAudit(
    actor: AuthUserIdentity,
    session: PracticeSession,
  ): AuditInput {
    return {
      actorUserId: actor.userId,
      action: SESSION_CREATED_ACTION,
      resourceType: SESSION_RESOURCE_TYPE,
      resourceId: session.id,
      teamId: session.teamId,
      seasonId: session.seasonId,
      correlationId: null,
      outcome: AuditOutcome.Success,
      diff: { sessionType: session.sessionType, status: session.status },
    };
  }
}
