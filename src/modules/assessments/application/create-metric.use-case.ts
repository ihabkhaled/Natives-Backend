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

import { AssessmentDuplicateError } from '../errors/assessment-duplicate.error';
import { AssessmentValidationError } from '../errors/assessment-validation.error';
import { AssessmentCatalogRepository } from '../infrastructure/assessment-catalog.repository';
import {
  METRIC_CREATED_ACTION,
  METRIC_RESOURCE_TYPE,
} from '../model/assessments.constants';
import type {
  AssessmentMetric,
  CreateMetricCommand,
  NewMetric,
} from '../model/assessments.types';
import { AssessmentScopeService } from './assessment-scope.service';

/**
 * Creates the first version of a team-scoped assessment metric definition.
 * Validates that the referenced category and scale exist and that the metric key
 * is free within the team, then appends version 1 (family = the new row) and an
 * audit entry in one transaction. Definitions are immutable — later edits create
 * new versions rather than mutating this row.
 */
@Injectable()
export class CreateMetricUseCase {
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
    command: CreateMetricCommand,
  ): Promise<AssessmentMetric> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, teamId, command),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateMetricCommand,
  ): Promise<AssessmentMetric> {
    await this.scope.validate(scope, teamId, null);
    await this.requireReferences(scope, command);
    if (await this.catalog.metricKeyExists(scope, teamId, command.key)) {
      throw new AssessmentDuplicateError();
    }
    const metric = await this.catalog.insertMetric(
      scope,
      this.build(teamId, command, actor.userId),
    );
    await this.audit.record(scope, this.buildAudit(actor, metric));
    return metric;
  }

  private async requireReferences(
    scope: TransactionScope,
    command: CreateMetricCommand,
  ): Promise<void> {
    const present = await this.catalog.referencesExist(
      scope,
      command.categoryId,
      command.scaleId,
    );
    if (!present) {
      throw new AssessmentValidationError();
    }
  }

  private build(
    teamId: string,
    command: CreateMetricCommand,
    createdBy: string,
  ): NewMetric {
    const id = this.idGenerator.generate();
    return {
      id,
      familyId: id,
      teamId,
      categoryId: command.categoryId,
      scaleId: command.scaleId,
      key: command.key,
      name: command.name,
      definition: command.definition,
      direction: command.direction,
      guidance: command.guidance,
      applicability: command.applicability,
      tags: command.tags,
      version: 1,
      createdBy,
      now: this.clock.now(),
    };
  }

  private buildAudit(
    actor: AuthUserIdentity,
    metric: AssessmentMetric,
  ): AuditInput {
    return {
      actorUserId: actor.userId,
      action: METRIC_CREATED_ACTION,
      resourceType: METRIC_RESOURCE_TYPE,
      resourceId: metric.id,
      teamId: metric.teamId,
      seasonId: null,
      correlationId: null,
      outcome: AuditOutcome.Success,
      diff: { key: metric.key, version: metric.version },
    };
  }
}
