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

import { AgendaLockedError } from '../errors/agenda-locked.error';
import { AgendaNotFoundError } from '../errors/agenda-not-found.error';
import { AgendaBlockRepository } from '../infrastructure/agenda-block.repository';
import { AgendaGroupRepository } from '../infrastructure/agenda-group.repository';
import { AgendaStationRepository } from '../infrastructure/agenda-station.repository';
import { PracticeAgendaRepository } from '../infrastructure/practice-agenda.repository';
import {
  buildAgendaAudit,
  buildNewAgenda,
  buildNewBlock,
  buildNewGroup,
  buildNewGroupMember,
  buildNewStation,
  toBlockCommand,
  toGroupCommand,
  toStationCommand,
} from '../lib/agendas.builders';
import { toAgendaSummaryView } from '../lib/agendas.mapper';
import {
  AGENDA_BLOCK_SCAN_LIMIT,
  AGENDA_COPIED_ACTION,
  AGENDA_GROUP_MEMBER_SCAN_LIMIT,
  AGENDA_GROUP_SCAN_LIMIT,
  AGENDA_STATION_SCAN_LIMIT,
} from '../model/agendas.constants';
import { AgendaStatus } from '../model/agendas.enums';
import type {
  Agenda,
  AgendaBlock,
  AgendaGroup,
  AgendaSummaryView,
  CopyAgendaCommand,
} from '../model/agendas.types';
import type { PracticeSession } from '../model/practices.types';
import { PracticeLookupService } from './practice-lookup.service';

/**
 * Copies a plan from a source session's agenda into the target session's fresh
 * DRAFT agenda (drill.manage). Every row is re-created with a NEW id, so the copy is
 * fully independent — editing it never touches the source; drill references are
 * carried by id (the catalog is shared). Both sessions are resolved in team scope
 * (cross-team ⇒ 404); the target must be an empty draft (copying over an existing or
 * published plan is refused).
 */
@Injectable()
export class CopyAgendaUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly sessions: PracticeLookupService,
    private readonly agendas: PracticeAgendaRepository,
    private readonly blocks: AgendaBlockRepository,
    private readonly stations: AgendaStationRepository,
    private readonly groups: AgendaGroupRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    command: CopyAgendaCommand,
  ): Promise<AgendaSummaryView> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, teamId, sessionId, command),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    command: CopyAgendaCommand,
  ): Promise<AgendaSummaryView> {
    const target = await this.sessions.requireSession(scope, teamId, sessionId);
    const source = await this.requireSourceAgenda(
      scope,
      teamId,
      command.sourceSessionId,
    );
    const agenda = await this.ensureTargetAgenda(scope, target, source, actor);
    await this.copyTree(scope, source.id, agenda, actor);
    await this.audit.record(
      scope,
      buildAgendaAudit(AGENDA_COPIED_ACTION, agenda, actor.userId, {
        sourceSessionId: source.sessionId,
      }),
    );
    return toAgendaSummaryView(agenda);
  }

  private async requireSourceAgenda(
    scope: TransactionScope,
    teamId: string,
    sourceSessionId: string,
  ): Promise<Agenda> {
    await this.sessions.requireSession(scope, teamId, sourceSessionId);
    const agenda = await this.agendas.findBySession(scope, sourceSessionId);
    if (agenda === null) {
      throw new AgendaNotFoundError();
    }
    return agenda;
  }

  private async ensureTargetAgenda(
    scope: TransactionScope,
    target: PracticeSession,
    source: Agenda,
    actor: AuthUserIdentity,
  ): Promise<Agenda> {
    const created = await this.agendas.insertAgenda(
      scope,
      buildNewAgenda(
        this.idGenerator.generate(),
        target,
        { theme: source.theme, notes: source.notes },
        actor.userId,
        this.clock.now(),
      ),
    );
    return created ?? this.requireEmptyDraft(scope, target.id);
  }

  private async requireEmptyDraft(
    scope: TransactionScope,
    sessionId: string,
  ): Promise<Agenda> {
    const agenda = await this.agendas.findBySession(scope, sessionId);
    if (agenda === null) {
      throw new AgendaNotFoundError();
    }
    const ids = await this.blocks.listIdsByAgenda(scope, agenda.id, 1);
    if (agenda.status !== AgendaStatus.Draft || ids.length > 0) {
      throw new AgendaLockedError();
    }
    return agenda;
  }

  private async copyTree(
    scope: TransactionScope,
    sourceAgendaId: string,
    agenda: Agenda,
    actor: AuthUserIdentity,
  ): Promise<void> {
    const groupMap = await this.copyGroups(scope, sourceAgendaId, agenda);
    const blockMap = await this.copyBlocks(
      scope,
      sourceAgendaId,
      agenda,
      actor,
    );
    await this.copyStations(scope, sourceAgendaId, blockMap, groupMap);
    await this.copyMembers(scope, sourceAgendaId, groupMap);
  }

  private async copyGroups(
    scope: TransactionScope,
    sourceAgendaId: string,
    agenda: Agenda,
  ): Promise<Map<string, AgendaGroup>> {
    const source = await this.groups.listGroupsByAgenda(
      scope,
      sourceAgendaId,
      AGENDA_GROUP_SCAN_LIMIT,
    );
    const map = new Map<string, AgendaGroup>();
    for (const group of source) {
      const created = await this.groups.insertGroup(
        scope,
        buildNewGroup(
          this.idGenerator.generate(),
          agenda,
          group.position,
          toGroupCommand(group),
          this.clock.now(),
        ),
      );
      map.set(group.id, created);
    }
    return map;
  }

  private async copyBlocks(
    scope: TransactionScope,
    sourceAgendaId: string,
    agenda: Agenda,
    actor: AuthUserIdentity,
  ): Promise<Map<string, AgendaBlock>> {
    const source = await this.blocks.listByAgenda(
      scope,
      sourceAgendaId,
      AGENDA_BLOCK_SCAN_LIMIT,
    );
    const map = new Map<string, AgendaBlock>();
    for (const block of source) {
      const created = await this.blocks.insert(
        scope,
        buildNewBlock(
          this.idGenerator.generate(),
          agenda,
          block.position,
          toBlockCommand(block),
          actor.userId,
          this.clock.now(),
        ),
      );
      map.set(block.id, created);
    }
    return map;
  }

  private async copyStations(
    scope: TransactionScope,
    sourceAgendaId: string,
    blockMap: Map<string, AgendaBlock>,
    groupMap: Map<string, AgendaGroup>,
  ): Promise<void> {
    const source = await this.stations.listByAgenda(
      scope,
      sourceAgendaId,
      AGENDA_STATION_SCAN_LIMIT,
    );
    for (const station of source) {
      const block = blockMap.get(station.blockId);
      if (block === undefined) {
        continue;
      }
      const groupId =
        station.groupId === null
          ? null
          : (groupMap.get(station.groupId)?.id ?? null);
      await this.stations.insert(
        scope,
        buildNewStation(
          this.idGenerator.generate(),
          block,
          station.position,
          toStationCommand(station, groupId),
          this.clock.now(),
        ),
      );
    }
  }

  private async copyMembers(
    scope: TransactionScope,
    sourceAgendaId: string,
    groupMap: Map<string, AgendaGroup>,
  ): Promise<void> {
    const source = await this.groups.listMembersByAgenda(
      scope,
      sourceAgendaId,
      AGENDA_GROUP_MEMBER_SCAN_LIMIT,
    );
    for (const member of source) {
      const group = groupMap.get(member.groupId);
      if (group === undefined) {
        continue;
      }
      await this.groups.addMember(
        scope,
        buildNewGroupMember(
          this.idGenerator.generate(),
          group,
          member.membershipId,
          this.clock.now(),
        ),
      );
    }
  }
}
