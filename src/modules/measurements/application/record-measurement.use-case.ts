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
  AuditRecorderService,
  RecordDomainEventService,
} from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { assertAttempts } from '../domain/measurement-attempt.policy';
import { acceptsAttempts } from '../domain/measurement-session.state-machine';
import { MeasurementInvalidTransitionError } from '../errors/measurement-invalid-transition.error';
import { MeasurementProtocolNotFoundError } from '../errors/measurement-protocol-not-found.error';
import { MeasurementSessionNotFoundError } from '../errors/measurement-session-not-found.error';
import { MeasurementAttemptRepository } from '../infrastructure/measurement-attempt.repository';
import { MeasurementProtocolRepository } from '../infrastructure/measurement-protocol.repository';
import { MeasurementSessionRepository } from '../infrastructure/measurement-session.repository';
import {
  buildMeasurementRecordedEvent,
  buildNewAttempts,
  buildRecordAudit,
  buildRecordedMeasurement,
} from '../lib/measurements.builders';
import { MEASUREMENT_RECORDED_ACTION } from '../model/measurements.constants';
import type {
  RecordedMeasurement,
  RecordMeasurementCommand,
  RecordTarget,
} from '../model/measurements.types';
import { MeasurementScopeService } from './measurement-scope.service';

/**
 * Records a player's raw attempts for one protocol within a session. Validates
 * scope, membership, session state (a cancelled session accepts nothing), and the
 * protocol, then converts and appends the immutable attempts, and writes an audit
 * entry plus a `measurement.recorded.v1` outbox event — all in one transaction so
 * the fact and its event commit atomically. Raw attempts are never mutated; the
 * best/average result is derived, never stored as an editable total.
 */
@Injectable()
export class RecordMeasurementUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly scope: MeasurementScopeService,
    private readonly sessions: MeasurementSessionRepository,
    private readonly protocols: MeasurementProtocolRepository,
    private readonly attempts: MeasurementAttemptRepository,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    command: RecordMeasurementCommand,
  ): Promise<RecordedMeasurement> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, sessionId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    command: RecordMeasurementCommand,
  ): Promise<RecordedMeasurement> {
    await this.scope.validate(tx, teamId, null);
    await this.scope.requireMembership(tx, teamId, command.membershipId);
    const target = await this.resolveTarget(tx, teamId, sessionId, command);
    const recorded = await this.persist(tx, actor, teamId, target, command);
    return this.finish(tx, actor, teamId, recorded);
  }

  private async resolveTarget(
    tx: TransactionScope,
    teamId: string,
    sessionId: string,
    command: RecordMeasurementCommand,
  ): Promise<RecordTarget> {
    const session = await this.sessions.findForWrite(tx, teamId, sessionId);
    if (session === null) {
      throw new MeasurementSessionNotFoundError();
    }
    if (!acceptsAttempts(session.status)) {
      throw new MeasurementInvalidTransitionError();
    }
    const protocol = await this.protocols.findVisible(
      tx,
      teamId,
      command.protocolId,
    );
    if (protocol === null) {
      throw new MeasurementProtocolNotFoundError();
    }
    assertAttempts(command.attempts, protocol);
    const baseAttemptNumber = await this.attempts.nextAttemptBase(
      tx,
      session.id,
      command.membershipId,
      command.protocolId,
    );
    return { session, protocol, baseAttemptNumber };
  }

  private async persist(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    target: RecordTarget,
    command: RecordMeasurementCommand,
  ): Promise<RecordedMeasurement> {
    await this.attempts.insertMany(
      tx,
      buildNewAttempts(
        target.session.id,
        teamId,
        command,
        target.protocol,
        target.baseAttemptNumber,
        actor.userId,
        () => this.idGenerator.generate(),
        this.clock.now(),
      ),
    );
    const persisted = await this.attempts.listForTarget(
      tx,
      target.session.id,
      command.membershipId,
      command.protocolId,
    );
    return buildRecordedMeasurement(
      target.session.id,
      command.membershipId,
      target.protocol,
      persisted,
    );
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    recorded: RecordedMeasurement,
  ): Promise<RecordedMeasurement> {
    await this.audit.record(
      tx,
      buildRecordAudit(
        MEASUREMENT_RECORDED_ACTION,
        actor.userId,
        recorded,
        teamId,
      ),
    );
    await this.events.enqueue(
      tx,
      buildMeasurementRecordedEvent(actor.userId, teamId, recorded),
    );
    return recorded;
  }
}
