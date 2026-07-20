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
import {
  AuditRecorderService,
  RecordDomainEventService,
} from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { assertCompetitionContent } from '../domain/competition.policy';
import { CompetitionRepository } from '../infrastructure/competition.repository';
import {
  buildCompetitionAudit,
  buildCompetitionCreatedEvent,
  buildNewCompetition,
} from '../lib/competitions.builders';
import { COMPETITION_CREATED_ACTION } from '../model/competitions.constants';
import type {
  Competition,
  CreateCompetitionCommand,
} from '../model/competitions.types';
import { CompetitionScopeService } from './competition-scope.service';

/**
 * Creates a DRAFT competition for a team + season. Validates the team/season
 * scope and the cross-field content invariants, writes the competition, an audit
 * entry, and a `competition.created` event in one transaction. A new competition
 * is never visible until it is published.
 */
@Injectable()
export class CreateCompetitionUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly scope: CompetitionScopeService,
    private readonly repository: CompetitionRepository,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateCompetitionCommand,
  ): Promise<Competition> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateCompetitionCommand,
  ): Promise<Competition> {
    await this.scope.validate(tx, teamId, command.content.seasonId);
    assertCompetitionContent(command.content);
    const competition = await this.repository.insert(
      tx,
      buildNewCompetition(
        this.idGenerator.generate(),
        teamId,
        command.content,
        actor.userId,
        this.clock.now(),
      ),
    );
    return this.finish(tx, actor, competition);
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    competition: Competition,
  ): Promise<Competition> {
    await this.audit.record(
      tx,
      buildCompetitionAudit(
        COMPETITION_CREATED_ACTION,
        actor.userId,
        competition,
      ),
    );
    await this.events.enqueue(
      tx,
      buildCompetitionCreatedEvent(competition, actor.userId),
    );
    return competition;
  }
}
