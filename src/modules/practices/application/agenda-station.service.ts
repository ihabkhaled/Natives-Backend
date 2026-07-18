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

import { AttendanceMembershipNotFoundError } from '../errors/attendance-membership-not-found.error';
import { DrillNotFoundError } from '../errors/drill-not-found.error';
import { AgendaStationRepository } from '../infrastructure/agenda-station.repository';
import { AttendanceMembershipRepository } from '../infrastructure/attendance-membership.repository';
import { DrillRepository } from '../infrastructure/drill.repository';
import { PracticeAgendaRepository } from '../infrastructure/practice-agenda.repository';
import {
  buildAgendaChildAudit,
  buildNewStation,
} from '../lib/agendas.builders';
import { toStationView } from '../lib/agendas.mapper';
import {
  STATION_ADDED_ACTION,
  STATION_REMOVED_ACTION,
  STATION_RESOURCE_TYPE,
} from '../model/agendas.constants';
import type {
  Agenda,
  AgendaBlock,
  AgendaStation,
  CreateStationCommand,
  StationView,
} from '../model/agendas.types';
import { AgendaLookupService } from './agenda-lookup.service';

/**
 * Authoring of stations nested under an agenda block (drill.manage). Structural,
 * so it requires a DRAFT agenda (publish lock) and bumps the agenda version. Every
 * optional reference (drill, group, assigned coach) is validated within the same
 * team/agenda scope so a cross-scope id is a clean not-found rather than a raw
 * foreign-key error.
 */
@Injectable()
export class AgendaStationService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly lookup: AgendaLookupService,
    private readonly stations: AgendaStationRepository,
    private readonly agendas: PracticeAgendaRepository,
    private readonly drills: DrillRepository,
    private readonly memberships: AttendanceMembershipRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  addStation(
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    blockId: string,
    command: CreateStationCommand,
  ): Promise<StationView> {
    return this.unitOfWork.runInTransaction(scope =>
      this.runAdd(scope, actor, teamId, sessionId, blockId, command),
    );
  }

  removeStation(
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    blockId: string,
    stationId: string,
  ): Promise<void> {
    return this.unitOfWork.runInTransaction(scope =>
      this.runRemove(scope, actor, teamId, sessionId, blockId, stationId),
    );
  }

  private async runAdd(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    blockId: string,
    command: CreateStationCommand,
  ): Promise<StationView> {
    const agenda = await this.lookup.requireDraft(scope, teamId, sessionId);
    const block = await this.lookup.requireBlock(scope, agenda.id, blockId);
    await this.assertRefs(scope, teamId, agenda.id, command);
    const station = await this.persistNew(scope, block, command);
    return this.finishAdd(scope, agenda, actor, station);
  }

  private async finishAdd(
    scope: TransactionScope,
    agenda: Agenda,
    actor: AuthUserIdentity,
    station: AgendaStation,
  ): Promise<StationView> {
    await this.bumpAgenda(scope, agenda, actor);
    await this.recordAudit(
      scope,
      agenda,
      actor,
      STATION_ADDED_ACTION,
      station.id,
    );
    return toStationView(station);
  }

  private async runRemove(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    blockId: string,
    stationId: string,
  ): Promise<void> {
    const agenda = await this.lookup.requireDraft(scope, teamId, sessionId);
    const block = await this.lookup.requireBlock(scope, agenda.id, blockId);
    await this.stations.remove(scope, block.id, stationId);
    await this.bumpAgenda(scope, agenda, actor);
    await this.recordAudit(
      scope,
      agenda,
      actor,
      STATION_REMOVED_ACTION,
      stationId,
    );
  }

  private async persistNew(
    scope: TransactionScope,
    block: AgendaBlock,
    command: CreateStationCommand,
  ): Promise<AgendaStation> {
    const position = await this.stations.nextPosition(scope, block.id);
    return this.stations.insert(
      scope,
      buildNewStation(
        this.idGenerator.generate(),
        block,
        position,
        command,
        this.clock.now(),
      ),
    );
  }

  private async assertRefs(
    scope: TransactionScope,
    teamId: string,
    agendaId: string,
    command: CreateStationCommand,
  ): Promise<void> {
    await this.assertDrill(scope, teamId, command.drillId);
    await this.assertGroup(scope, agendaId, command.groupId);
    await this.assertMembership(scope, teamId, command.coachMembershipId);
  }

  private async assertDrill(
    scope: TransactionScope,
    teamId: string,
    drillId: string | null,
  ): Promise<void> {
    if (
      drillId !== null &&
      (await this.drills.findByIdInTeam(scope, teamId, drillId)) === null
    ) {
      throw new DrillNotFoundError();
    }
  }

  private async assertGroup(
    scope: TransactionScope,
    agendaId: string,
    groupId: string | null,
  ): Promise<void> {
    if (groupId !== null) {
      await this.lookup.requireGroup(scope, agendaId, groupId);
    }
  }

  private async assertMembership(
    scope: TransactionScope,
    teamId: string,
    membershipId: string | null,
  ): Promise<void> {
    if (
      membershipId !== null &&
      (await this.memberships.findByIdInTeam(scope, teamId, membershipId)) ===
        null
    ) {
      throw new AttendanceMembershipNotFoundError();
    }
  }

  private bumpAgenda(
    scope: TransactionScope,
    agenda: Agenda,
    actor: AuthUserIdentity,
  ): Promise<Agenda | null> {
    return this.agendas.bumpVersion(
      scope,
      agenda.id,
      actor.userId,
      null,
      this.clock.now(),
    );
  }

  private recordAudit(
    scope: TransactionScope,
    agenda: Agenda,
    actor: AuthUserIdentity,
    action: string,
    resourceId: string,
  ): Promise<void> {
    return this.audit.record(
      scope,
      buildAgendaChildAudit(
        action,
        STATION_RESOURCE_TYPE,
        resourceId,
        agenda,
        actor.userId,
        { status: agenda.status },
      ),
    );
  }
}
