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

import { GovernanceValidationError } from '../errors/governance-validation.error';
import { GovernanceDirectoryRepository } from '../infrastructure/governance-directory.repository';
import {
  buildGovernanceAudit,
  buildNewAppointment,
  buildNewPosition,
} from '../lib/governance.builders';
import {
  APPOINTMENT_RECORDED_ACTION,
  APPOINTMENT_RESOURCE_TYPE,
  POSITION_CREATED_ACTION,
  POSITION_RESOURCE_TYPE,
} from '../model/governance.constants';
import type {
  CreatePositionCommand,
  GovernanceAppointment,
  GovernancePosition,
  RecordAppointmentCommand,
} from '../model/governance.types';
import { GovernanceLookupService } from './governance-lookup.service';

/**
 * Manages governance titles and their appointments (UN-603). A title is
 * configurable and permission-free. Recording a substantive appointment ends the
 * prior holder's term first, so the position always has at most one active
 * non-acting holder and the term history is complete without overlap. An acting
 * appointment runs alongside the substantive one.
 */
@Injectable()
export class ManageDirectoryUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly ids: IdGeneratorPort,
    private readonly lookup: GovernanceLookupService,
    private readonly directory: GovernanceDirectoryRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  createPosition(
    actor: AuthUserIdentity,
    teamId: string,
    command: CreatePositionCommand,
  ): Promise<GovernancePosition> {
    return this.unitOfWork.runInTransaction(tx =>
      this.runCreate(tx, actor, teamId, command),
    );
  }

  recordAppointment(
    actor: AuthUserIdentity,
    teamId: string,
    positionId: string,
    command: RecordAppointmentCommand,
  ): Promise<GovernanceAppointment> {
    return this.unitOfWork.runInTransaction(tx =>
      this.runAppoint(tx, actor, teamId, positionId, command),
    );
  }

  private async runCreate(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: CreatePositionCommand,
  ): Promise<GovernancePosition> {
    await this.lookup.requireTeam(tx, teamId);
    const position = await this.directory.insertPosition(
      tx,
      buildNewPosition(
        this.ids.generate(),
        teamId,
        command.content,
        actor.userId,
        this.clock.now(),
      ),
    );
    await this.audit.record(
      tx,
      buildGovernanceAudit(
        POSITION_CREATED_ACTION,
        POSITION_RESOURCE_TYPE,
        actor.userId,
        teamId,
        position.positionId,
        { positionKey: position.positionKey, status: position.status },
      ),
    );
    return position;
  }

  private async runAppoint(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    positionId: string,
    command: RecordAppointmentCommand,
  ): Promise<GovernanceAppointment> {
    const position = await this.lookup.requirePosition(tx, teamId, positionId);
    await this.lookup.requireMember(tx, teamId, command.content.membershipId);
    this.assertDates(command);
    if (!command.content.acting) {
      await this.directory.endActiveAppointments(
        tx,
        position.positionId,
        command.content.startsOn,
        this.clock.now(),
      );
    }
    return this.writeAppointment(
      tx,
      actor,
      teamId,
      position.positionId,
      command,
    );
  }

  private assertDates(command: RecordAppointmentCommand): void {
    const { startsOn, endsOn } = command.content;
    if (endsOn !== null && endsOn < startsOn) {
      throw new GovernanceValidationError();
    }
  }

  private async writeAppointment(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    positionId: string,
    command: RecordAppointmentCommand,
  ): Promise<GovernanceAppointment> {
    const appointment = await this.directory.insertAppointment(
      tx,
      buildNewAppointment(
        this.ids.generate(),
        teamId,
        positionId,
        command.content,
        actor.userId,
        this.clock.now(),
      ),
    );
    await this.audit.record(
      tx,
      buildGovernanceAudit(
        APPOINTMENT_RECORDED_ACTION,
        APPOINTMENT_RESOURCE_TYPE,
        actor.userId,
        teamId,
        appointment.appointmentId,
        {
          positionId,
          membershipId: appointment.membershipId,
          acting: appointment.acting,
        },
      ),
    );
    return appointment;
  }
}
