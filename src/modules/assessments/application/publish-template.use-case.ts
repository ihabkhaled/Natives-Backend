import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
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

import { AssessmentTemplateLockedError } from '../errors/assessment-template-locked.error';
import { AssessmentTemplateNotFoundError } from '../errors/assessment-template-not-found.error';
import { AssessmentVersionConflictError } from '../errors/assessment-version-conflict.error';
import { AssessmentCatalogRepository } from '../infrastructure/assessment-catalog.repository';
import {
  TEMPLATE_PUBLISHED_ACTION,
  TEMPLATE_RESOURCE_TYPE,
} from '../model/assessments.constants';
import { AssessmentTemplateStatus } from '../model/assessments.enums';
import type {
  AssessmentTemplate,
  PublishTemplateCommand,
} from '../model/assessments.types';

/**
 * Publishes a draft template version, locking it: a published version is immutable
 * (enforced in the database) and becomes eligible for assessment periods. Only a
 * draft can be published; a already-published or archived version is refused as
 * locked, and a stale record version is refused as a conflict.
 */
@Injectable()
export class PublishTemplateUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly catalog: AssessmentCatalogRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    templateId: string,
    command: PublishTemplateCommand,
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
    command: PublishTemplateCommand,
  ): Promise<AssessmentTemplate> {
    const current = await this.catalog.findTemplateForWrite(
      scope,
      teamId,
      templateId,
    );
    if (current === null) {
      throw new AssessmentTemplateNotFoundError();
    }
    if (current.status !== AssessmentTemplateStatus.Draft) {
      throw new AssessmentTemplateLockedError();
    }
    const published = await this.catalog.publishTemplate(scope, {
      id: templateId,
      teamId,
      expectedRecordVersion: command.expectedRecordVersion,
      publishedBy: actor.userId,
      now: this.clock.now(),
    });
    if (published === null) {
      throw new AssessmentVersionConflictError();
    }
    await this.audit.record(scope, this.buildAudit(actor, published));
    return published;
  }

  private buildAudit(
    actor: AuthUserIdentity,
    template: AssessmentTemplate,
  ): AuditInput {
    return {
      actorUserId: actor.userId,
      action: TEMPLATE_PUBLISHED_ACTION,
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
