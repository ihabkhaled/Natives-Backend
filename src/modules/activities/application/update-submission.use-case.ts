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

import { assertSubmissionContent } from '../domain/activity-submission.policy';
import { canEditSubmission } from '../domain/activity-submission.state-machine';
import { ActivityDuplicateSubmissionError } from '../errors/activity-duplicate-submission.error';
import { ActivityInvalidTransitionError } from '../errors/activity-invalid-transition.error';
import { ActivityVersionConflictError } from '../errors/activity-version-conflict.error';
import { ActivityBuddyRepository } from '../infrastructure/activity-buddy.repository';
import { ActivityEvidenceRepository } from '../infrastructure/activity-evidence.repository';
import { ActivitySubmissionRepository } from '../infrastructure/activity-submission.repository';
import {
  buildContentUpdate,
  buildEvidenceRows,
  buildSubmissionAudit,
} from '../lib/activity.builders';
import { toCalendarDay } from '../lib/activity.helpers';
import { toSubmissionDetailView } from '../lib/activity.response.mapper';
import { SUBMISSION_UPDATED_ACTION } from '../model/activities.constants';
import type {
  ActivitySubmission,
  UpdateSubmissionCommand,
} from '../model/activity.types';
import type { SubmissionDetailView } from '../model/activity.views';
import { ActivityCatalogService } from './activity-catalog.service';
import { ActivityScopeService } from './activity-scope.service';
import { SubmissionLookupService } from './submission-lookup.service';

/**
 * Edits an editable submission (draft or changes-requested) owned by the acting
 * member: replaces the content and the evidence collection under an optimistic
 * version guard. Buddies are fixed at creation and untouched here. Locked states
 * are an invalid transition; a stale version is a conflict.
 */
@Injectable()
export class UpdateSubmissionUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly scope: ActivityScopeService,
    private readonly catalog: ActivityCatalogService,
    private readonly lookup: SubmissionLookupService,
    private readonly submissions: ActivitySubmissionRepository,
    private readonly buddies: ActivityBuddyRepository,
    private readonly evidence: ActivityEvidenceRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    submissionId: string,
    command: UpdateSubmissionCommand,
  ): Promise<SubmissionDetailView> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, submissionId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    submissionId: string,
    command: UpdateSubmissionCommand,
  ): Promise<SubmissionDetailView> {
    const current = await this.lookup.requireForWrite(tx, teamId, submissionId);
    this.lookup.requireOwner(current, actor.userId);
    if (!canEditSubmission(current.status)) {
      throw new ActivityInvalidTransitionError();
    }
    await this.scope.validate(tx, teamId, command.content.seasonId);
    const type = await this.catalog.requireActiveType(
      tx,
      command.content.activityTypeId,
    );
    assertSubmissionContent(
      command.content,
      type,
      toCalendarDay(this.clock.now()),
    );
    await this.assertNotDuplicate(tx, current, command);
    const updated = await this.applyUpdate(tx, teamId, submissionId, command);
    return this.finish(tx, actor, updated, command);
  }

  private async assertNotDuplicate(
    tx: TransactionScope,
    current: ActivitySubmission,
    command: UpdateSubmissionCommand,
  ): Promise<void> {
    const exists = await this.submissions.existsLiveForMember(
      tx,
      current.membershipId,
      command.content.activityTypeId,
      command.content.performedOn,
      current.id,
    );
    if (exists) {
      throw new ActivityDuplicateSubmissionError();
    }
  }

  private async applyUpdate(
    tx: TransactionScope,
    teamId: string,
    submissionId: string,
    command: UpdateSubmissionCommand,
  ): Promise<ActivitySubmission> {
    const updated = await this.submissions.updateContent(
      tx,
      buildContentUpdate(
        submissionId,
        teamId,
        command.expectedRecordVersion,
        command.content,
        this.clock.now(),
      ),
    );
    if (updated === null) {
      throw new ActivityVersionConflictError();
    }
    return updated;
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    submission: ActivitySubmission,
    command: UpdateSubmissionCommand,
  ): Promise<SubmissionDetailView> {
    await this.evidence.clearForSubmission(tx, submission.id);
    await this.evidence.insertMany(
      tx,
      buildEvidenceRows(
        submission.id,
        command.evidence,
        actor.userId,
        () => this.idGenerator.generate(),
        this.clock.now(),
      ),
    );
    await this.audit.record(
      tx,
      buildSubmissionAudit(SUBMISSION_UPDATED_ACTION, actor.userId, submission),
    );
    return this.detail(tx, submission);
  }

  private async detail(
    tx: TransactionScope,
    submission: ActivitySubmission,
  ): Promise<SubmissionDetailView> {
    const buddies = await this.buddies.listForSubmission(tx, submission.id);
    const evidenceCount = await this.evidence.countForSubmission(
      tx,
      submission.id,
    );
    return toSubmissionDetailView({ submission, buddies, evidenceCount });
  }
}
