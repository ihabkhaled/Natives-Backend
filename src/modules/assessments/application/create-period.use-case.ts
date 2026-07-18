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
  type AuditInput,
  AuditOutcome,
  AuditRecorderService,
} from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { assertPeriodRange } from '../domain/assessment-catalog.policy';
import { AssessmentTemplateNotFoundError } from '../errors/assessment-template-not-found.error';
import { AssessmentCatalogRepository } from '../infrastructure/assessment-catalog.repository';
import {
  PERIOD_CREATED_ACTION,
  PERIOD_RESOURCE_TYPE,
} from '../model/assessments.constants';
import type {
  AssessmentPeriod,
  CreatePeriodCommand,
  NewPeriod,
} from '../model/assessments.types';
import { AssessmentScopeService } from './assessment-scope.service';

/**
 * Opens an assessment period: a dated window (inclusive, date-only in the team's
 * calendar) that binds a cohort to a published template. The date range and
 * team/season scope are validated, and the referenced template must already be
 * published in the team — draft templates cannot back a live period.
 */
@Injectable()
export class CreatePeriodUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly scope: AssessmentScopeService,
    private readonly catalog: AssessmentCatalogRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    command: CreatePeriodCommand,
  ): Promise<AssessmentPeriod> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, teamId, command),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: CreatePeriodCommand,
  ): Promise<AssessmentPeriod> {
    assertPeriodRange(command.startsOn, command.endsOn);
    await this.scope.validate(scope, teamId, command.seasonId);
    const published = await this.catalog.publishedTemplateExists(
      scope,
      teamId,
      command.templateId,
    );
    if (!published) {
      throw new AssessmentTemplateNotFoundError();
    }
    const period = await this.catalog.insertPeriod(
      scope,
      this.build(teamId, command, actor.userId),
    );
    await this.audit.record(scope, this.buildAudit(actor, period));
    return period;
  }

  private build(
    teamId: string,
    command: CreatePeriodCommand,
    createdBy: string,
  ): NewPeriod {
    return {
      id: this.idGenerator.generate(),
      teamId,
      seasonId: command.seasonId,
      templateId: command.templateId,
      name: command.name,
      cohort: command.cohort,
      startsOn: command.startsOn,
      endsOn: command.endsOn,
      createdBy,
      now: this.clock.now(),
    };
  }

  private buildAudit(
    actor: AuthUserIdentity,
    period: AssessmentPeriod,
  ): AuditInput {
    return {
      actorUserId: actor.userId,
      action: PERIOD_CREATED_ACTION,
      resourceType: PERIOD_RESOURCE_TYPE,
      resourceId: period.id,
      teamId: period.teamId,
      seasonId: period.seasonId,
      correlationId: null,
      outcome: AuditOutcome.Success,
      diff: {
        templateId: period.templateId,
        startsOn: period.startsOn,
        endsOn: period.endsOn,
      },
    };
  }
}
