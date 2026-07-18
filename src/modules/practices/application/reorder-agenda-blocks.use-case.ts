import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { AuditRecorderService } from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import {
  isValidReorder,
  toPositionWrites,
} from '../domain/agenda-ordering.policy';
import { InvalidReorderError } from '../errors/invalid-reorder.error';
import { OptimisticConflictError } from '../errors/optimistic-conflict.error';
import { AgendaBlockRepository } from '../infrastructure/agenda-block.repository';
import { PracticeAgendaRepository } from '../infrastructure/practice-agenda.repository';
import { buildAgendaAudit } from '../lib/agendas.builders';
import { toAgendaSummaryView } from '../lib/agendas.mapper';
import {
  AGENDA_BLOCK_SCAN_LIMIT,
  BLOCK_REORDERED_ACTION,
} from '../model/agendas.constants';
import type {
  Agenda,
  AgendaSummaryView,
  ReorderBlocksCommand,
} from '../model/agendas.types';
import { AgendaLookupService } from './agenda-lookup.service';

/**
 * Reorders an agenda's blocks under optimistic concurrency. The requested id list
 * must be a permutation of exactly the current blocks (pure ordering policy), the
 * agenda must be an editable DRAFT, and the agenda version must match
 * `expectedVersion` — so two concurrent reorders (or a reorder racing a structural
 * edit) cannot both win: the loser gets a clean version conflict. All positions
 * move atomically in one set-based UPDATE.
 */
@Injectable()
export class ReorderAgendaBlocksUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly lookup: AgendaLookupService,
    private readonly agendas: PracticeAgendaRepository,
    private readonly blocks: AgendaBlockRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    command: ReorderBlocksCommand,
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
    command: ReorderBlocksCommand,
  ): Promise<AgendaSummaryView> {
    const agenda = await this.lookup.requireAgenda(scope, teamId, sessionId);
    this.lookup.requireEditable(agenda);
    const existingIds = await this.blocks.listIdsByAgenda(
      scope,
      agenda.id,
      AGENDA_BLOCK_SCAN_LIMIT,
    );
    if (!isValidReorder(existingIds, command.blockIds)) {
      throw new InvalidReorderError();
    }
    const bumped = await this.guardVersion(scope, agenda.id, actor, command);
    await this.applyOrder(scope, agenda.id, command.blockIds);
    await this.audit.record(
      scope,
      buildAgendaAudit(BLOCK_REORDERED_ACTION, bumped, actor.userId, {
        blocks: command.blockIds.length,
      }),
    );
    return toAgendaSummaryView(bumped);
  }

  private async guardVersion(
    scope: TransactionScope,
    agendaId: string,
    actor: AuthUserIdentity,
    command: ReorderBlocksCommand,
  ): Promise<Agenda> {
    const bumped = await this.agendas.bumpVersion(
      scope,
      agendaId,
      actor.userId,
      command.expectedVersion,
      this.clock.now(),
    );
    if (bumped === null) {
      throw new OptimisticConflictError();
    }
    return bumped;
  }

  private applyOrder(
    scope: TransactionScope,
    agendaId: string,
    blockIds: readonly string[],
  ): Promise<void> {
    return this.blocks.reposition(
      scope,
      agendaId,
      toPositionWrites(blockIds),
      this.clock.now(),
    );
  }
}
