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

import { OpponentConflictError } from '../errors/opponent-conflict.error';
import { OpponentRepository } from '../infrastructure/opponent.repository';
import {
  buildNewOpponent,
  buildOpponentAudit,
} from '../lib/competitions.builders';
import type {
  CreateOpponentCommand,
  Opponent,
} from '../model/competitions.types';
import { CompetitionScopeService } from './competition-scope.service';

/**
 * Adds an external team to a team's opponent catalogue. The team scope is
 * validated, the opponent is inserted idempotently on its unique name (a duplicate
 * raises 409, never a second row), and the change is audited in one transaction.
 */
@Injectable()
export class CreateOpponentUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly scope: CompetitionScopeService,
    private readonly repository: OpponentRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateOpponentCommand,
  ): Promise<Opponent> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateOpponentCommand,
  ): Promise<Opponent> {
    await this.scope.requireTeam(tx, teamId);
    const opponent = await this.repository.insert(
      tx,
      buildNewOpponent(
        this.idGenerator.generate(),
        teamId,
        command.content,
        actor.userId,
        this.clock.now(),
      ),
    );
    if (opponent === null) {
      throw new OpponentConflictError();
    }
    await this.audit.record(tx, buildOpponentAudit(actor.userId, opponent));
    return opponent;
  }
}
