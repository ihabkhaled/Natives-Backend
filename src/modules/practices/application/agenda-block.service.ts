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

import { canRecordExecution } from '../domain/agenda.state-machine';
import { DrillNotFoundError } from '../errors/drill-not-found.error';
import { InvalidAgendaTransitionError } from '../errors/invalid-agenda-transition.error';
import { OptimisticConflictError } from '../errors/optimistic-conflict.error';
import { AgendaBlockRepository } from '../infrastructure/agenda-block.repository';
import { DrillRepository } from '../infrastructure/drill.repository';
import { PracticeAgendaRepository } from '../infrastructure/practice-agenda.repository';
import {
  buildAgendaChildAudit,
  buildBlockCompletion,
  buildBlockUpdate,
  buildNewBlock,
} from '../lib/agendas.builders';
import { toBlockView } from '../lib/agendas.mapper';
import {
  BLOCK_ADDED_ACTION,
  BLOCK_COMPLETED_ACTION,
  BLOCK_REMOVED_ACTION,
  BLOCK_RESOURCE_TYPE,
  BLOCK_UPDATED_ACTION,
} from '../model/agendas.constants';
import type {
  Agenda,
  AgendaBlock,
  BlockView,
  CompleteBlockCommand,
  CreateBlockCommand,
  UpdateBlockCommand,
} from '../model/agendas.types';
import { AgendaLookupService } from './agenda-lookup.service';

/**
 * Authoring of ordered agenda blocks (drill.manage). Structural writes (add/remove)
 * require a DRAFT agenda (publish lock) and bump the agenda version so a concurrent
 * reorder loses the race; content updates keep a block-level optimistic guard.
 * Completion is execution, allowed only after the agenda is published. Coach notes
 * are echoed back on these authoring responses; any drill reference is validated in
 * team scope.
 */
@Injectable()
export class AgendaBlockService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly lookup: AgendaLookupService,
    private readonly blocks: AgendaBlockRepository,
    private readonly agendas: PracticeAgendaRepository,
    private readonly drills: DrillRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  addBlock(
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    command: CreateBlockCommand,
  ): Promise<BlockView> {
    return this.unitOfWork.runInTransaction(scope =>
      this.runAdd(scope, actor, teamId, sessionId, command),
    );
  }

  updateBlock(
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    blockId: string,
    command: UpdateBlockCommand,
  ): Promise<BlockView> {
    return this.unitOfWork.runInTransaction(scope =>
      this.runUpdate(scope, actor, teamId, sessionId, blockId, command),
    );
  }

  removeBlock(
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    blockId: string,
  ): Promise<void> {
    return this.unitOfWork.runInTransaction(scope =>
      this.runRemove(scope, actor, teamId, sessionId, blockId),
    );
  }

  completeBlock(
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    blockId: string,
    command: CompleteBlockCommand,
  ): Promise<BlockView> {
    return this.unitOfWork.runInTransaction(scope =>
      this.runComplete(scope, actor, teamId, sessionId, blockId, command),
    );
  }

  private async runAdd(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    command: CreateBlockCommand,
  ): Promise<BlockView> {
    const agenda = await this.lookup.requireDraft(scope, teamId, sessionId);
    await this.assertDrill(scope, teamId, command.drillId);
    const block = await this.persistNew(scope, agenda, command, actor);
    await this.bumpAgenda(scope, agenda, actor);
    return this.respond(scope, agenda, actor, BLOCK_ADDED_ACTION, block);
  }

  private async runUpdate(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    blockId: string,
    command: UpdateBlockCommand,
  ): Promise<BlockView> {
    const agenda = await this.lookup.requireDraft(scope, teamId, sessionId);
    await this.lookup.requireBlock(scope, agenda.id, blockId);
    await this.assertDrill(scope, teamId, command.drillId);
    return this.finishUpdate(scope, agenda, actor, blockId, command);
  }

  private async finishUpdate(
    scope: TransactionScope,
    agenda: Agenda,
    actor: AuthUserIdentity,
    blockId: string,
    command: UpdateBlockCommand,
  ): Promise<BlockView> {
    const updated = this.requireUpdated(
      await this.blocks.update(
        scope,
        buildBlockUpdate(blockId, command, actor.userId, this.clock.now()),
      ),
    );
    return this.respond(scope, agenda, actor, BLOCK_UPDATED_ACTION, updated);
  }

  private async runRemove(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    blockId: string,
  ): Promise<void> {
    const agenda = await this.lookup.requireDraft(scope, teamId, sessionId);
    const block = await this.lookup.requireBlock(scope, agenda.id, blockId);
    await this.blocks.remove(scope, agenda.id, blockId);
    await this.bumpAgenda(scope, agenda, actor);
    await this.auditBlock(scope, agenda, actor, BLOCK_REMOVED_ACTION, block);
  }

  private async runComplete(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    blockId: string,
    command: CompleteBlockCommand,
  ): Promise<BlockView> {
    const agenda = await this.lookup.requireAgenda(scope, teamId, sessionId);
    this.requireExecutable(agenda);
    await this.lookup.requireBlock(scope, agenda.id, blockId);
    return this.finishComplete(scope, agenda, actor, blockId, command);
  }

  private async finishComplete(
    scope: TransactionScope,
    agenda: Agenda,
    actor: AuthUserIdentity,
    blockId: string,
    command: CompleteBlockCommand,
  ): Promise<BlockView> {
    const updated = this.requireUpdated(
      await this.blocks.complete(
        scope,
        buildBlockCompletion(blockId, command, actor.userId, this.clock.now()),
      ),
    );
    return this.respond(scope, agenda, actor, BLOCK_COMPLETED_ACTION, updated);
  }

  private async persistNew(
    scope: TransactionScope,
    agenda: Agenda,
    command: CreateBlockCommand,
    actor: AuthUserIdentity,
  ): Promise<AgendaBlock> {
    const position = await this.blocks.nextPosition(scope, agenda.id);
    return this.blocks.insert(
      scope,
      buildNewBlock(
        this.idGenerator.generate(),
        agenda,
        position,
        command,
        actor.userId,
        this.clock.now(),
      ),
    );
  }

  private requireExecutable(agenda: Agenda): void {
    if (!canRecordExecution(agenda.status)) {
      throw new InvalidAgendaTransitionError();
    }
  }

  private requireUpdated(block: AgendaBlock | null): AgendaBlock {
    if (block === null) {
      throw new OptimisticConflictError();
    }
    return block;
  }

  private async respond(
    scope: TransactionScope,
    agenda: Agenda,
    actor: AuthUserIdentity,
    action: string,
    block: AgendaBlock,
  ): Promise<BlockView> {
    await this.auditBlock(scope, agenda, actor, action, block);
    return toBlockView(block, [], true);
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

  private auditBlock(
    scope: TransactionScope,
    agenda: Agenda,
    actor: AuthUserIdentity,
    action: string,
    block: AgendaBlock,
  ): Promise<void> {
    return this.audit.record(
      scope,
      buildAgendaChildAudit(
        action,
        BLOCK_RESOURCE_TYPE,
        block.id,
        agenda,
        actor.userId,
        { status: agenda.status, blockType: block.blockType },
      ),
    );
  }
}
