import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { AuditRecorderService } from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { nextSessionStatus } from '../domain/measurement-session.state-machine';
import { MeasurementInvalidTransitionError } from '../errors/measurement-invalid-transition.error';
import { MeasurementSessionNotFoundError } from '../errors/measurement-session-not-found.error';
import { MeasurementVersionConflictError } from '../errors/measurement-version-conflict.error';
import { MeasurementSessionRepository } from '../infrastructure/measurement-session.repository';
import {
  buildSessionAudit,
  buildSessionStatusChange,
} from '../lib/measurements.builders';
import { SESSION_TRANSITIONED_ACTION } from '../model/measurements.constants';
import { SessionStatus } from '../model/measurements.enums';
import type {
  MeasurementSession,
  TransitionSessionCommand,
} from '../model/measurements.types';
import { MeasurementScopeService } from './measurement-scope.service';

/**
 * Moves a measurement session along its lifecycle (conduct or cancel). Validates
 * scope, resolves the session, applies the pure state machine, and writes the
 * optimistic-version-guarded status change plus an audit entry in one
 * transaction. An illegal verb is a 409; a stale version is a 409 conflict.
 */
@Injectable()
export class TransitionMeasurementSessionUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly scope: MeasurementScopeService,
    private readonly repository: MeasurementSessionRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    command: TransitionSessionCommand,
  ): Promise<MeasurementSession> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, sessionId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    command: TransitionSessionCommand,
  ): Promise<MeasurementSession> {
    await this.scope.validate(tx, teamId, null);
    const session = await this.requireSession(tx, teamId, sessionId);
    const toStatus = this.resolveTarget(session, command);
    const updated = await this.applyChange(
      tx,
      teamId,
      session,
      toStatus,
      command,
    );
    await this.audit.record(
      tx,
      buildSessionAudit(SESSION_TRANSITIONED_ACTION, actor.userId, updated),
    );
    return updated;
  }

  private async requireSession(
    tx: TransactionScope,
    teamId: string,
    sessionId: string,
  ): Promise<MeasurementSession> {
    const session = await this.repository.findForWrite(tx, teamId, sessionId);
    if (session === null) {
      throw new MeasurementSessionNotFoundError();
    }
    return session;
  }

  private resolveTarget(
    session: MeasurementSession,
    command: TransitionSessionCommand,
  ): SessionStatus {
    const toStatus = nextSessionStatus(session.status, command.transition);
    if (toStatus === null) {
      throw new MeasurementInvalidTransitionError();
    }
    return toStatus;
  }

  private async applyChange(
    tx: TransactionScope,
    teamId: string,
    session: MeasurementSession,
    toStatus: SessionStatus,
    command: TransitionSessionCommand,
  ): Promise<MeasurementSession> {
    const updated = await this.repository.applyStatusChange(
      tx,
      buildSessionStatusChange(
        session,
        teamId,
        toStatus,
        command.expectedRecordVersion,
        this.clock.now(),
      ),
    );
    if (updated === null) {
      throw new MeasurementVersionConflictError();
    }
    return updated;
  }
}
