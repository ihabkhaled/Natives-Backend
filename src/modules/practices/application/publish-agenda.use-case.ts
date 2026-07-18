import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import {
  AuditRecorderService,
  RecordDomainEventService,
} from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { canPublish } from '../domain/agenda.state-machine';
import { InvalidAgendaTransitionError } from '../errors/invalid-agenda-transition.error';
import { OptimisticConflictError } from '../errors/optimistic-conflict.error';
import { AgendaBlockRepository } from '../infrastructure/agenda-block.repository';
import { PracticeAgendaRepository } from '../infrastructure/practice-agenda.repository';
import {
  buildAgendaAudit,
  buildAgendaEvent,
  buildAgendaLifecycleWrite,
} from '../lib/agendas.builders';
import { toAgendaSummaryView } from '../lib/agendas.mapper';
import {
  AGENDA_BLOCK_SCAN_LIMIT,
  AGENDA_PUBLISHED_ACTION,
  AGENDA_PUBLISHED_EVENT,
} from '../model/agendas.constants';
import type {
  Agenda,
  AgendaSummaryView,
  AgendaVersionCommand,
} from '../model/agendas.types';
import { AgendaLookupService } from './agenda-lookup.service';

/**
 * Publishes (locks the structure of) a session's agenda: DRAFT → PUBLISHED under
 * optimistic concurrency, validated by the pure state machine. In one transaction
 * it flips the state, writes an audit row, and enqueues a versioned
 * `practice.agenda.published` event to the transactional outbox. After publish the
 * plan can only be executed/completed, never silently restructured.
 */
@Injectable()
export class PublishAgendaUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly lookup: AgendaLookupService,
    private readonly agendas: PracticeAgendaRepository,
    private readonly blocks: AgendaBlockRepository,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    command: AgendaVersionCommand,
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
    command: AgendaVersionCommand,
  ): Promise<AgendaSummaryView> {
    const agenda = await this.lookup.requireAgenda(scope, teamId, sessionId);
    if (!canPublish(agenda.status)) {
      throw new InvalidAgendaTransitionError();
    }
    const published = await this.publish(scope, agenda, command, actor);
    return this.record(scope, actor, published);
  }

  private async publish(
    scope: TransactionScope,
    agenda: Agenda,
    command: AgendaVersionCommand,
    actor: AuthUserIdentity,
  ): Promise<Agenda> {
    const published = await this.agendas.publish(
      scope,
      buildAgendaLifecycleWrite(
        agenda.id,
        actor.userId,
        command.expectedVersion,
        this.clock.now(),
      ),
    );
    if (published === null) {
      throw new OptimisticConflictError();
    }
    return published;
  }

  private async record(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    agenda: Agenda,
  ): Promise<AgendaSummaryView> {
    const blockCount = (
      await this.blocks.listIdsByAgenda(
        scope,
        agenda.id,
        AGENDA_BLOCK_SCAN_LIMIT,
      )
    ).length;
    await this.audit.record(
      scope,
      buildAgendaAudit(AGENDA_PUBLISHED_ACTION, agenda, actor.userId, {
        status: agenda.status,
        blocks: blockCount,
      }),
    );
    await this.events.enqueue(
      scope,
      buildAgendaEvent(AGENDA_PUBLISHED_EVENT, agenda, actor.userId, {
        sessionId: agenda.sessionId,
        status: agenda.status,
        blockCount,
      }),
    );
    return toAgendaSummaryView(agenda);
  }
}
