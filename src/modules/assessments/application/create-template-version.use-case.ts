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
import { AssessmentTemplateNotFoundError } from '../errors/assessment-template-not-found.error';
import { AssessmentValidationError } from '../errors/assessment-validation.error';
import { AssessmentCatalogRepository } from '../infrastructure/assessment-catalog.repository';
import {
  TEMPLATE_RESOURCE_TYPE,
  TEMPLATE_VERSION_CREATED_ACTION,
} from '../model/assessments.constants';
import type {
  AssessmentTemplate,
  CreateTemplateCommand,
  NewTemplate,
} from '../model/assessments.types';
import { AssessmentScopeService } from './assessment-scope.service';

/**
 * Appends a new draft version of an existing template family. The prior published
 * versions stay immutable; this writes a fresh draft sharing the family id and key
 * at the next sequential version, with revalidated weights, metrics, and scope.
 */
@Injectable()
export class CreateTemplateVersionUseCase {
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
    templateId: string,
    command: CreateTemplateCommand,
  ): Promise<AssessmentTemplate> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, teamId, templateId, command),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    templateId: string,
    command: CreateTemplateCommand,
  ): Promise<AssessmentTemplate> {
    const current = await this.catalog.findTemplateForWrite(
      scope,
      teamId,
      templateId,
    );
    if (current === null) {
      throw new AssessmentTemplateNotFoundError();
    }
    await this.validate(scope, teamId, current, command);
    const version = await this.catalog.nextTemplateVersion(
      scope,
      current.familyId,
    );
    const template = await this.catalog.insertTemplate(
      scope,
      this.build(teamId, current.familyId, version, command, actor.userId),
      command.categoryWeights,
      command.metrics,
    );
    await this.audit.record(scope, this.buildAudit(actor, template));
    return template;
  }

  private async validate(
    scope: TransactionScope,
    teamId: string,
    current: AssessmentTemplate,
    command: CreateTemplateCommand,
  ): Promise<void> {
    assertCategoryWeights(command.categoryWeights);
    assertRequiredMetrics(command.metrics);
    await this.scope.validate(scope, teamId, command.seasonId);
    const present = await this.catalog.templateReferencesExist(
      scope,
      teamId,
      command.categoryWeights,
      command.metrics,
    );
    if (!present || command.key !== current.key) {
      throw new AssessmentValidationError();
    }
  }

  private build(
    teamId: string,
    familyId: string,
    version: number,
    command: CreateTemplateCommand,
    createdBy: string,
  ): NewTemplate {
    return {
      id: this.idGenerator.generate(),
      familyId,
      teamId,
      seasonId: command.seasonId,
      key: command.key,
      name: command.name,
      cohort: command.cohort,
      evaluatorRoles: command.evaluatorRoles,
      scoreVersion: command.scoreVersion,
      version,
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
      action: TEMPLATE_VERSION_CREATED_ACTION,
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
