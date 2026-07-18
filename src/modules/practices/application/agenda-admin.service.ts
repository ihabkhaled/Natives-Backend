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

import { AgendaNotFoundError } from '../errors/agenda-not-found.error';
import { PracticeAgendaRepository } from '../infrastructure/practice-agenda.repository';
import { buildAgendaAudit, buildNewAgenda } from '../lib/agendas.builders';
import { toAgendaSummaryView } from '../lib/agendas.mapper';
import { AGENDA_CREATED_ACTION } from '../model/agendas.constants';
import type {
  Agenda,
  AgendaSummaryView,
  CreateAgendaCommand,
  NewAgenda,
} from '../model/agendas.types';
import type { PracticeSession } from '../model/practices.types';
import { PracticeLookupService } from './practice-lookup.service';

/**
 * Creates (ensures) a session's draft agenda (drill.manage). Idempotent: the unique
 * `session_id` makes a second create a no-op that returns the existing agenda rather
 * than a duplicate. Resolves the session within team scope first, so a cross-team id
 * is a clean 404, and audits the creation.
 */
@Injectable()
export class AgendaAdminService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly sessions: PracticeLookupService,
    private readonly agendas: PracticeAgendaRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  createAgenda(
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    command: CreateAgendaCommand,
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
    command: CreateAgendaCommand,
  ): Promise<AgendaSummaryView> {
    const session = await this.sessions.requireSession(
      scope,
      teamId,
      sessionId,
    );
    const inserted = await this.insert(scope, session, command, actor);
    const agenda = inserted ?? (await this.requireExisting(scope, session.id));
    return toAgendaSummaryView(agenda);
  }

  private async insert(
    scope: TransactionScope,
    session: PracticeSession,
    command: CreateAgendaCommand,
    actor: AuthUserIdentity,
  ): Promise<Agenda | null> {
    const agenda = await this.agendas.insertAgenda(
      scope,
      this.newRow(session, command, actor),
    );
    if (agenda !== null) {
      await this.auditCreated(scope, agenda, actor);
    }
    return agenda;
  }

  private newRow(
    session: PracticeSession,
    command: CreateAgendaCommand,
    actor: AuthUserIdentity,
  ): NewAgenda {
    return buildNewAgenda(
      this.idGenerator.generate(),
      session,
      command,
      actor.userId,
      this.clock.now(),
    );
  }

  private auditCreated(
    scope: TransactionScope,
    agenda: Agenda,
    actor: AuthUserIdentity,
  ): Promise<void> {
    return this.audit.record(
      scope,
      buildAgendaAudit(AGENDA_CREATED_ACTION, agenda, actor.userId, {
        status: agenda.status,
      }),
    );
  }

  private async requireExisting(
    scope: TransactionScope,
    sessionId: string,
  ): Promise<Agenda> {
    const agenda = await this.agendas.findBySession(scope, sessionId);
    if (agenda === null) {
      throw new AgendaNotFoundError();
    }
    return agenda;
  }
}
