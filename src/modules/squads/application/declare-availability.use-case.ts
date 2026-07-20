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

import { AvailabilityMembershipNotFoundError } from '../errors/availability-membership-not-found.error';
import { SquadAvailabilityRepository } from '../infrastructure/squad-availability.repository';
import { SquadEligibilityRepository } from '../infrastructure/squad-eligibility.repository';
import {
  buildAvailabilityAudit,
  buildAvailabilityUpsert,
} from '../lib/squads.builders';
import { AvailabilitySource } from '../model/squads.enums';
import type {
  Availability,
  DeclareAvailabilityCommand,
} from '../model/squads.types';
import { SquadLookupService } from './squad-lookup.service';

/**
 * A member declares their own availability for a squad's competition/period
 * (squad.read). The membership is resolved from the authenticated token — never
 * the body — so a principal can only speak for themselves. Upserts the declaration
 * and records an audit entry in one transaction.
 */
@Injectable()
export class DeclareAvailabilityUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly lookup: SquadLookupService,
    private readonly eligibility: SquadEligibilityRepository,
    private readonly availability: SquadAvailabilityRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    squadId: string,
    command: DeclareAvailabilityCommand,
  ): Promise<Availability> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, squadId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    squadId: string,
    command: DeclareAvailabilityCommand,
  ): Promise<Availability> {
    const squad = await this.lookup.require(tx, teamId, squadId);
    const membershipId = await this.eligibility.resolveActiveMembership(
      tx,
      squad.teamId,
      squad.seasonId,
      actor.userId,
    );
    if (membershipId === null) {
      throw new AvailabilityMembershipNotFoundError();
    }
    const declared = await this.availability.upsert(
      tx,
      buildAvailabilityUpsert(
        this.idGenerator.generate(),
        squad.squadId,
        squad.teamId,
        membershipId,
        command.availability,
        command.reason,
        AvailabilitySource.Self,
        actor.userId,
        this.clock.now(),
      ),
    );
    await this.audit.record(
      tx,
      buildAvailabilityAudit(actor.userId, declared, squad.seasonId),
    );
    return declared;
  }
}
