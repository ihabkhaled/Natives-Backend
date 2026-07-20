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

import { canDeclareAvailability } from '../domain/roster-availability.policy';
import { RosterAvailabilityMembershipNotFoundError } from '../errors/roster-availability-membership-not-found.error';
import { RosterLockedError } from '../errors/roster-locked.error';
import { RosterAvailabilityRepository } from '../infrastructure/roster-availability.repository';
import { RosterSourceRepository } from '../infrastructure/roster-source.repository';
import {
  buildAvailabilityAudit,
  buildAvailabilityUpsert,
} from '../lib/rosters.builders';
import { RosterAvailabilitySource } from '../model/rosters.enums';
import type {
  DeclareRosterAvailabilityCommand,
  Roster,
  RosterAvailabilityRecord,
} from '../model/rosters.types';
import { RosterLookupService } from './roster-lookup.service';

/**
 * A member declares their own going / not-going for a roster (roster.read). The
 * membership is resolved from the authenticated token — never the body — so a
 * principal can only ever speak for themselves. The window closes once the roster
 * is locked or its selection deadline passes; what was declared before then stays
 * frozen on the entries. Upsert + audit commit in one transaction.
 */
@Injectable()
export class DeclareRosterAvailabilityUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly lookup: RosterLookupService,
    private readonly source: RosterSourceRepository,
    private readonly availability: RosterAvailabilityRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    rosterId: string,
    command: DeclareRosterAvailabilityCommand,
  ): Promise<RosterAvailabilityRecord> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, rosterId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    rosterId: string,
    command: DeclareRosterAvailabilityCommand,
  ): Promise<RosterAvailabilityRecord> {
    const roster = await this.lookup.require(tx, teamId, rosterId);
    this.assertOpen(roster);
    const membershipId = await this.membership(tx, roster, actor);
    return this.persist(tx, actor, roster, membershipId, command);
  }

  private assertOpen(roster: Roster): void {
    const open = canDeclareAvailability(
      roster.status,
      roster.selectionDeadline,
      this.clock.now(),
    );
    if (!open) {
      throw new RosterLockedError();
    }
  }

  private async membership(
    tx: TransactionScope,
    roster: Roster,
    actor: AuthUserIdentity,
  ): Promise<string> {
    const membershipId = await this.source.resolveActiveMembership(
      tx,
      roster.teamId,
      roster.seasonId,
      actor.userId,
    );
    if (membershipId === null) {
      throw new RosterAvailabilityMembershipNotFoundError();
    }
    return membershipId;
  }

  private async persist(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    roster: Roster,
    membershipId: string,
    command: DeclareRosterAvailabilityCommand,
  ): Promise<RosterAvailabilityRecord> {
    const declared = await this.availability.upsert(
      tx,
      buildAvailabilityUpsert(
        this.idGenerator.generate(),
        roster.rosterId,
        roster.teamId,
        membershipId,
        command.availability,
        command.reason,
        RosterAvailabilitySource.Self,
        actor.userId,
        this.clock.now(),
      ),
    );
    await this.audit.record(
      tx,
      buildAvailabilityAudit(actor.userId, declared, roster.seasonId),
    );
    return declared;
  }
}
