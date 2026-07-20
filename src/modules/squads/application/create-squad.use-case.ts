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

import { assertSquadContent } from '../domain/squad-content.policy';
import { SquadRepository } from '../infrastructure/squad.repository';
import {
  buildNewSquad,
  buildSquadAudit,
  buildSquadCreatedEvent,
} from '../lib/squads.builders';
import {
  ELIGIBILITY_POLICY_VERSION,
  SQUAD_CREATED_ACTION,
} from '../model/squads.constants';
import type { CreateSquadCommand, Squad } from '../model/squads.types';
import { SquadScopeService } from './squad-scope.service';

/**
 * Creates a DRAFT squad for a team + season (and optional competition). Validates
 * the scope and the content invariants, writes the squad, an audit entry, and a
 * `squad.created` event in one transaction. A new squad is an empty, editable pool
 * — nothing is selected and no signal has excluded anyone.
 */
@Injectable()
export class CreateSquadUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly scope: SquadScopeService,
    private readonly repository: SquadRepository,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateSquadCommand,
  ): Promise<Squad> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateSquadCommand,
  ): Promise<Squad> {
    const { content } = command;
    await this.scope.validate(
      tx,
      teamId,
      content.seasonId,
      content.competitionId,
    );
    assertSquadContent(content);
    const squad = await this.repository.insert(
      tx,
      buildNewSquad(
        this.idGenerator.generate(),
        teamId,
        content,
        ELIGIBILITY_POLICY_VERSION,
        actor.userId,
        this.clock.now(),
      ),
    );
    return this.finish(tx, actor, squad);
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    squad: Squad,
  ): Promise<Squad> {
    await this.audit.record(
      tx,
      buildSquadAudit(SQUAD_CREATED_ACTION, actor.userId, squad),
    );
    await this.events.enqueue(tx, buildSquadCreatedEvent(squad, actor.userId));
    return squad;
  }
}
