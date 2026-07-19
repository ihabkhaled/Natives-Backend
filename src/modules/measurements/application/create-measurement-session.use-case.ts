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
import { AuditRecorderService } from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { MeasurementSessionRepository } from '../infrastructure/measurement-session.repository';
import {
  buildNewSession,
  buildSessionAudit,
} from '../lib/measurements.builders';
import { SESSION_CREATED_ACTION } from '../model/measurements.constants';
import type {
  CreateSessionCommand,
  MeasurementSession,
} from '../model/measurements.types';
import { MeasurementScopeService } from './measurement-scope.service';

/**
 * Schedules a measurement session for a team/season. Validates the scope, then
 * writes the SCHEDULED session and an audit entry in one transaction. A session is
 * planned first and only later conducted or cancelled through its state machine.
 */
@Injectable()
export class CreateMeasurementSessionUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly scope: MeasurementScopeService,
    private readonly repository: MeasurementSessionRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateSessionCommand,
  ): Promise<MeasurementSession> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateSessionCommand,
  ): Promise<MeasurementSession> {
    await this.scope.validate(tx, teamId, command.content.seasonId);
    const session = await this.repository.insert(
      tx,
      buildNewSession(
        this.idGenerator.generate(),
        teamId,
        command.content,
        actor.userId,
        this.clock.now(),
      ),
    );
    await this.audit.record(
      tx,
      buildSessionAudit(SESSION_CREATED_ACTION, actor.userId, session),
    );
    return session;
  }
}
