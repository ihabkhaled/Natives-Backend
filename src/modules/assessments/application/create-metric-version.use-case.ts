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

import { AssessmentMetricNotFoundError } from '../errors/assessment-metric-not-found.error';
import { AssessmentValidationError } from '../errors/assessment-validation.error';
import { AssessmentCatalogRepository } from '../infrastructure/assessment-catalog.repository';
import {
  METRIC_RESOURCE_TYPE,
  METRIC_VERSION_CREATED_ACTION,
} from '../model/assessments.constants';
import type {
  AssessmentMetric,
  CreateMetricCommand,
  NewMetric,
} from '../model/assessments.types';

/**
 * Appends a new, higher version of an existing team metric definition. The prior
 * version is preserved unchanged (definitions are immutable and downstream rows
 * pin concrete version ids); this writes a fresh row sharing the family id and
 * key, with the next sequential version. The referenced key must match the family
 * and the new category/scale must exist.
 */
@Injectable()
export class CreateMetricVersionUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly catalog: AssessmentCatalogRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    metricId: string,
    command: CreateMetricCommand,
  ): Promise<AssessmentMetric> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, teamId, metricId, command),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    metricId: string,
    command: CreateMetricCommand,
  ): Promise<AssessmentMetric> {
    const current = await this.catalog.findMetricForWrite(
      scope,
      teamId,
      metricId,
    );
    if (current === null) {
      throw new AssessmentMetricNotFoundError();
    }
    await this.requireCompatibleReferences(scope, current, command);
    const version = await this.catalog.nextMetricVersion(
      scope,
      current.familyId,
    );
    const created = await this.catalog.insertMetric(
      scope,
      this.build(teamId, current.familyId, version, command, actor.userId),
    );
    await this.audit.record(scope, this.buildAudit(actor, created));
    return created;
  }

  private async requireCompatibleReferences(
    scope: TransactionScope,
    current: AssessmentMetric,
    command: CreateMetricCommand,
  ): Promise<void> {
    const present = await this.catalog.referencesExist(
      scope,
      command.categoryId,
      command.scaleId,
    );
    if (!present || command.key !== current.key) {
      throw new AssessmentValidationError();
    }
  }

  private build(
    teamId: string,
    familyId: string,
    version: number,
    command: CreateMetricCommand,
    createdBy: string,
  ): NewMetric {
    return {
      id: this.idGenerator.generate(),
      familyId,
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
      version,
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
      action: METRIC_VERSION_CREATED_ACTION,
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
