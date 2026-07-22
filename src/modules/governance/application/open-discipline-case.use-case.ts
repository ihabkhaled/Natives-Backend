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

import { DisciplineRepository } from '../infrastructure/discipline.repository';
import { buildNewCase, buildOpenedCaseAudit } from '../lib/governance.builders';
import {
  DISCIPLINE_RETENTION_DAYS_DEFAULT,
  MILLISECONDS_PER_DAY,
} from '../model/governance.constants';
import type {
  DisciplineCase,
  OpenDisciplineCommand,
} from '../model/governance.types';
import { GovernanceLookupService } from './governance-lookup.service';

/**
 * Opens a corrective-action case against a member (UN-602). A case is opened by
 * a human with a fact summary — never by a metric — and carries a long,
 * configurable retention deadline for the sensitive record. Discipline never
 * touches public rank: nothing here writes to points or leaderboards.
 */
@Injectable()
export class OpenDisciplineCaseUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly ids: IdGeneratorPort,
    private readonly lookup: GovernanceLookupService,
    private readonly discipline: DisciplineRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    command: OpenDisciplineCommand,
  ): Promise<DisciplineCase> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: OpenDisciplineCommand,
  ): Promise<DisciplineCase> {
    await this.lookup.requireMember(tx, teamId, command.content.membershipId);
    const now = this.clock.now();
    const disciplineCase = await this.discipline.insert(
      tx,
      buildNewCase(
        this.ids.generate(),
        teamId,
        command.content,
        actor.userId,
        this.retentionExpiry(now),
        now,
      ),
    );
    await this.audit.record(
      tx,
      buildOpenedCaseAudit(actor.userId, disciplineCase),
    );
    return disciplineCase;
  }

  private retentionExpiry(now: Date): Date {
    return new Date(
      now.getTime() + DISCIPLINE_RETENTION_DAYS_DEFAULT * MILLISECONDS_PER_DAY,
    );
  }
}
