import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { AgendaBlockRepository } from '../infrastructure/agenda-block.repository';
import { AgendaGroupRepository } from '../infrastructure/agenda-group.repository';
import { AgendaStationRepository } from '../infrastructure/agenda-station.repository';
import { PracticeAgendaRepository } from '../infrastructure/practice-agenda.repository';
import { emptyAgendaView, toAgendaView } from '../lib/agendas.mapper';
import {
  AGENDA_BLOCK_SCAN_LIMIT,
  AGENDA_GROUP_MEMBER_SCAN_LIMIT,
  AGENDA_GROUP_SCAN_LIMIT,
  AGENDA_STATION_SCAN_LIMIT,
} from '../model/agendas.constants';
import type { AgendaTreeParts, AgendaView } from '../model/agendas.types';
import { PracticeLookupService } from './practice-lookup.service';

/**
 * Read side for the agenda tree. The broad read (`getAgenda`, practice.read) omits
 * private coach notes entirely; the coach plan (`getAgendaPlan`, drill.manage)
 * includes them — field-level shaping keeps coach notes out of team-wide reads and
 * broad exports. Both resolve the session within team scope first (cross-team ⇒
 * 404) and return an explicit empty view when no agenda exists yet.
 */
@Injectable()
export class AgendaQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly sessions: PracticeLookupService,
    private readonly agendas: PracticeAgendaRepository,
    private readonly blocks: AgendaBlockRepository,
    private readonly stations: AgendaStationRepository,
    private readonly groups: AgendaGroupRepository,
  ) {}

  getAgenda(teamId: string, sessionId: string): Promise<AgendaView> {
    return this.unitOfWork.runInTransaction(scope =>
      this.resolve(scope, teamId, sessionId, false),
    );
  }

  getAgendaPlan(teamId: string, sessionId: string): Promise<AgendaView> {
    return this.unitOfWork.runInTransaction(scope =>
      this.resolve(scope, teamId, sessionId, true),
    );
  }

  private async resolve(
    scope: TransactionScope,
    teamId: string,
    sessionId: string,
    includePrivate: boolean,
  ): Promise<AgendaView> {
    await this.sessions.requireSession(scope, teamId, sessionId);
    const agenda = await this.agendas.findBySession(scope, sessionId);
    if (agenda === null) {
      return emptyAgendaView(sessionId);
    }
    const parts = await this.loadParts(scope, agenda.id);
    return toAgendaView(sessionId, agenda, parts, includePrivate);
  }

  private async loadParts(
    scope: TransactionScope,
    agendaId: string,
  ): Promise<AgendaTreeParts> {
    const structure = await this.loadStructure(scope, agendaId);
    const groups = await this.loadGroups(scope, agendaId);
    return { ...structure, ...groups };
  }

  private async loadStructure(
    scope: TransactionScope,
    agendaId: string,
  ): Promise<Pick<AgendaTreeParts, 'blocks' | 'stations'>> {
    const blocks = await this.blocks.listByAgenda(
      scope,
      agendaId,
      AGENDA_BLOCK_SCAN_LIMIT,
    );
    const stations = await this.stations.listByAgenda(
      scope,
      agendaId,
      AGENDA_STATION_SCAN_LIMIT,
    );
    return { blocks, stations };
  }

  private async loadGroups(
    scope: TransactionScope,
    agendaId: string,
  ): Promise<Pick<AgendaTreeParts, 'groups' | 'members'>> {
    const groups = await this.groups.listGroupsByAgenda(
      scope,
      agendaId,
      AGENDA_GROUP_SCAN_LIMIT,
    );
    const members = await this.groups.listMembersByAgenda(
      scope,
      agendaId,
      AGENDA_GROUP_MEMBER_SCAN_LIMIT,
    );
    return { groups, members };
  }
}
