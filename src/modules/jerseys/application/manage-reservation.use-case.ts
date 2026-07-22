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

import { JerseyVersionConflictError } from '../errors/jersey-version-conflict.error';
import { NumberCollisionError } from '../errors/number-collision.error';
import { NumberReservationRepository } from '../infrastructure/number-reservation.repository';
import {
  buildNewReservation,
  buildReservationAudit,
  buildReservationCreatedAudit,
} from '../lib/jerseys.builders';
import { RESERVATION_RELEASED_ACTION } from '../model/jerseys.constants';
import type {
  CreateReservationCommand,
  NumberReservation,
  ReleaseReservationCommand,
} from '../model/jerseys.types';
import { JerseyLookupService } from './jersey-lookup.service';

/**
 * Reserves and releases scoped shirt numbers (UN-604). Number uniqueness is
 * scoped by team/season/division: a collision inside that scope is refused, but
 * the SAME number is free in another division or season. A release is a soft
 * status change that keeps the used-number history, so a number's past owner is
 * always recoverable.
 */
@Injectable()
export class ManageReservationUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly ids: IdGeneratorPort,
    private readonly lookup: JerseyLookupService,
    private readonly reservations: NumberReservationRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  create(
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateReservationCommand,
  ): Promise<NumberReservation> {
    return this.unitOfWork.runInTransaction(tx =>
      this.runCreate(tx, actor, teamId, command),
    );
  }

  release(
    actor: AuthUserIdentity,
    teamId: string,
    reservationId: string,
    command: ReleaseReservationCommand,
  ): Promise<NumberReservation> {
    return this.unitOfWork.runInTransaction(tx =>
      this.runRelease(tx, actor, teamId, reservationId, command),
    );
  }

  private async runCreate(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateReservationCommand,
  ): Promise<NumberReservation> {
    const content = command.content;
    await this.lookup.requireSeason(tx, teamId, content.seasonId);
    await this.lookup.requireMember(tx, teamId, content.membershipId);
    await this.assertNumberFree(tx, teamId, content);
    const reservation = await this.reservations.insert(
      tx,
      buildNewReservation(
        this.ids.generate(),
        teamId,
        content,
        actor.userId,
        this.clock.now(),
      ),
    );
    await this.audit.record(
      tx,
      buildReservationCreatedAudit(actor.userId, reservation),
    );
    return reservation;
  }

  private async assertNumberFree(
    tx: TransactionScope,
    teamId: string,
    content: CreateReservationCommand['content'],
  ): Promise<void> {
    const active = await this.reservations.findActive(
      tx,
      teamId,
      content.seasonId,
      content.division,
      content.number,
    );
    if (active !== null) {
      throw new NumberCollisionError();
    }
  }

  private async runRelease(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    reservationId: string,
    command: ReleaseReservationCommand,
  ): Promise<NumberReservation> {
    await this.lookup.requireReservation(tx, teamId, reservationId);
    const released = await this.reservations.release(
      tx,
      teamId,
      reservationId,
      command.expectedRecordVersion,
      command.reason,
      this.clock.now(),
    );
    if (released === null) {
      throw new JerseyVersionConflictError();
    }
    await this.audit.record(
      tx,
      buildReservationAudit(
        RESERVATION_RELEASED_ACTION,
        actor.userId,
        released,
      ),
    );
    return released;
  }
}
