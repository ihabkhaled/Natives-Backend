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

import { assertProtocolContent } from '../domain/measurement-protocol.policy';
import { MeasurementProtocolDuplicateError } from '../errors/measurement-protocol-duplicate.error';
import { MeasurementProtocolRepository } from '../infrastructure/measurement-protocol.repository';
import {
  buildNewProtocol,
  buildProtocolAudit,
} from '../lib/measurements.builders';
import { PROTOCOL_CREATED_ACTION } from '../model/measurements.constants';
import type {
  CreateProtocolCommand,
  MeasurementProtocol,
} from '../model/measurements.types';
import { MeasurementScopeService } from './measurement-scope.service';

/**
 * Creates an ACTIVE measurement protocol for a team. Validates the team/season
 * scope and the definition, rejects a duplicate active key, then writes the
 * protocol and an audit entry in one transaction. Objective protocols carry their
 * own unit and direction — they are never forced onto a 0–5 subjective scale.
 */
@Injectable()
export class CreateMeasurementProtocolUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly scope: MeasurementScopeService,
    private readonly repository: MeasurementProtocolRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateProtocolCommand,
  ): Promise<MeasurementProtocol> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateProtocolCommand,
  ): Promise<MeasurementProtocol> {
    await this.scope.validate(tx, teamId, command.content.seasonId);
    assertProtocolContent(command.content);
    await this.requireUniqueKey(tx, teamId, command.content.protocolKey);
    const protocol = await this.repository.insert(
      tx,
      buildNewProtocol(
        this.idGenerator.generate(),
        teamId,
        command.content,
        actor.userId,
        this.clock.now(),
      ),
    );
    return this.finish(tx, actor, protocol);
  }

  private async requireUniqueKey(
    tx: TransactionScope,
    teamId: string,
    protocolKey: string,
  ): Promise<void> {
    if (await this.repository.activeKeyExists(tx, teamId, protocolKey)) {
      throw new MeasurementProtocolDuplicateError();
    }
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    protocol: MeasurementProtocol,
  ): Promise<MeasurementProtocol> {
    await this.audit.record(
      tx,
      buildProtocolAudit(PROTOCOL_CREATED_ACTION, actor.userId, protocol),
    );
    return protocol;
  }
}
