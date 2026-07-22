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

import { StandingsRuleRepository } from '../infrastructure/standings-rule.repository';
import { buildNewRuleVersion, buildRuleAudit } from '../lib/standings.builders';
import type {
  CreateStandingsRuleCommand,
  StandingsRuleVersion,
} from '../model/standings.types';
import { StandingsRuleService } from './standings-rule.service';

/**
 * Publishes the next version of a named standings rule (UN-506). A rule is never
 * edited: correcting the points or the tie-break ordering publishes version N+1,
 * and every standings table already computed keeps citing the version it ran
 * under. That is what makes an archived table reproducible years later.
 */
@Injectable()
export class CreateStandingsRuleUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly ids: IdGeneratorPort,
    private readonly rules: StandingsRuleRepository,
    private readonly ruleService: StandingsRuleService,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateStandingsRuleCommand,
  ): Promise<StandingsRuleVersion> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateStandingsRuleCommand,
  ): Promise<StandingsRuleVersion> {
    const version = await this.ruleService.nextVersion(
      tx,
      teamId,
      command.content.ruleKey,
    );
    const rule = await this.rules.insert(
      tx,
      buildNewRuleVersion(
        this.ids.generate(),
        teamId,
        command.content,
        version,
        actor.userId,
        this.clock.now(),
      ),
    );
    await this.audit.record(tx, buildRuleAudit(actor.userId, rule));
    return rule;
  }
}
