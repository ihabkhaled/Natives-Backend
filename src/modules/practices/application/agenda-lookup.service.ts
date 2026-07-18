import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { canEditStructure } from '../domain/agenda.state-machine';
import { AgendaBlockNotFoundError } from '../errors/agenda-block-not-found.error';
import { AgendaGroupNotFoundError } from '../errors/agenda-group-not-found.error';
import { AgendaLockedError } from '../errors/agenda-locked.error';
import { AgendaNotFoundError } from '../errors/agenda-not-found.error';
import { AgendaBlockRepository } from '../infrastructure/agenda-block.repository';
import { AgendaGroupRepository } from '../infrastructure/agenda-group.repository';
import { PracticeAgendaRepository } from '../infrastructure/practice-agenda.repository';
import type { Agenda, AgendaBlock, AgendaGroup } from '../model/agendas.types';
import { PracticeLookupService } from './practice-lookup.service';

/**
 * Shared read guards for team + session scoped agenda writes. Every guard resolves
 * the session within the caller's team scope first (a cross-team session id is a
 * clean 404), then the agenda/block/group within that scope. `requireEditable`
 * enforces the publish lock: a published/completed agenda refuses structural edits.
 */
@Injectable()
export class AgendaLookupService {
  constructor(
    private readonly sessions: PracticeLookupService,
    private readonly agendas: PracticeAgendaRepository,
    private readonly blocks: AgendaBlockRepository,
    private readonly groups: AgendaGroupRepository,
  ) {}

  async requireAgenda(
    scope: TransactionScope,
    teamId: string,
    sessionId: string,
  ): Promise<Agenda> {
    await this.sessions.requireSession(scope, teamId, sessionId);
    const agenda = await this.agendas.findBySession(scope, sessionId);
    if (agenda === null) {
      throw new AgendaNotFoundError();
    }
    return agenda;
  }

  requireEditable(agenda: Agenda): void {
    if (!canEditStructure(agenda.status)) {
      throw new AgendaLockedError();
    }
  }

  async requireDraft(
    scope: TransactionScope,
    teamId: string,
    sessionId: string,
  ): Promise<Agenda> {
    const agenda = await this.requireAgenda(scope, teamId, sessionId);
    this.requireEditable(agenda);
    return agenda;
  }

  async requireBlock(
    scope: TransactionScope,
    agendaId: string,
    blockId: string,
  ): Promise<AgendaBlock> {
    const block = await this.blocks.findByIdInAgenda(scope, agendaId, blockId);
    if (block === null) {
      throw new AgendaBlockNotFoundError();
    }
    return block;
  }

  async requireGroup(
    scope: TransactionScope,
    agendaId: string,
    groupId: string,
  ): Promise<AgendaGroup> {
    const group = await this.groups.findGroupByIdInAgenda(
      scope,
      agendaId,
      groupId,
    );
    if (group === null) {
      throw new AgendaGroupNotFoundError();
    }
    return group;
  }
}
