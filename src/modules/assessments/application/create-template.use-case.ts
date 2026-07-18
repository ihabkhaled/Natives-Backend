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

import {
  assertCategoryWeights,
  assertRequiredMetrics,
} from '../domain/assessment-catalog.policy';
import { AssessmentDuplicateError } from '../errors/assessment-duplicate.error';
import { AssessmentValidationError } from '../errors/assessment-validation.error';
import { AssessmentCatalogRepository } from '../infrastructure/assessment-catalog.repository';
import {
  TEMPLATE_CREATED_ACTION,
  TEMPLATE_RESOURCE_TYPE,
} from '../model/assessments.constants';
import type {
  AssessmentTemplate,
  CreateTemplateCommand,
  NewTemplate,
} from '../model/assessments.types';
import { AssessmentScopeService } from './assessment-scope.service';

/**
 * Creates the first draft version of a team assessment template: its evaluator
 * roles, category weights (must total 100), and ordered required/optional metrics.
 * Weights and metrics are validated as pure domain rules, every referenced
 * category/metric is checked within scope, and the template plus its relations and
 * an audit entry are written in one transaction. Drafts are editable; publishing
 * locks a version.
 */
@Injectable()
export class CreateTemplateUseCase {
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
    command: CreateTemplateCommand,
  ): Promise<AssessmentTemplate> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, teamId, command),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateTemplateCommand,
  ): Promise<AssessmentTemplate> {
    assertCategoryWeights(command.categoryWeights);
    assertRequiredMetrics(command.metrics);
    await this.scope.validate(scope, teamId, command.seasonId);
    await this.requireReferences(scope, teamId, command);
    if (await this.catalog.templateKeyExists(scope, teamId, command.key)) {
      throw new AssessmentDuplicateError();
    }
    const template = await this.catalog.insertTemplate(
      scope,
      this.build(teamId, command, actor.userId),
      command.categoryWeights,
      command.metrics,
    );
    await this.audit.record(scope, this.buildAudit(actor, template));
    return template;
  }

  private async requireReferences(
    scope: TransactionScope,
    teamId: string,
    command: CreateTemplateCommand,
  ): Promise<void> {
    const present = await this.catalog.templateReferencesExist(
      scope,
      teamId,
      command.categoryWeights,
      command.metrics,
    );
    if (!present) {
      throw new AssessmentValidationError();
    }
  }

  private build(
    teamId: string,
    command: CreateTemplateCommand,
    createdBy: string,
  ): NewTemplate {
    const id = this.idGenerator.generate();
    return {
      id,
      familyId: id,
      teamId,
      seasonId: command.seasonId,
      key: command.key,
      name: command.name,
      cohort: command.cohort,
      evaluatorRoles: command.evaluatorRoles,
      scoreVersion: command.scoreVersion,
      version: 1,
      createdBy,
      now: this.clock.now(),
    };
  }

  private buildAudit(
    actor: AuthUserIdentity,
    template: AssessmentTemplate,
  ): AuditInput {
    return {
      actorUserId: actor.userId,
      action: TEMPLATE_CREATED_ACTION,
      resourceType: TEMPLATE_RESOURCE_TYPE,
      resourceId: template.id,
      teamId: template.teamId,
      seasonId: template.seasonId,
      correlationId: null,
      outcome: AuditOutcome.Success,
      diff: { key: template.key, version: template.version },
    };
  }
}
