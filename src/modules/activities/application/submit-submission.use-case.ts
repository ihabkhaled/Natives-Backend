import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import {
  AuditRecorderService,
  RecordDomainEventService,
} from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { canSubmitSubmission } from '../domain/activity-submission.state-machine';
import { ActivityInvalidTransitionError } from '../errors/activity-invalid-transition.error';
import { ActivityVersionConflictError } from '../errors/activity-version-conflict.error';
import { ActivityBuddyRepository } from '../infrastructure/activity-buddy.repository';
import { ActivityEvidenceRepository } from '../infrastructure/activity-evidence.repository';
import { ActivitySubmissionRepository } from '../infrastructure/activity-submission.repository';
import {
  buildActivitySubmittedEvent,
  buildStatusChange,
  buildSubmissionAudit,
} from '../lib/activity.builders';
import { toSubmissionDetailView } from '../lib/activity.response.mapper';
import { SUBMISSION_SUBMITTED_ACTION } from '../model/activities.constants';
import { SubmissionStatus } from '../model/activity.enums';
import type {
  ActivitySubmission,
  SubmissionVersionCommand,
} from '../model/activity.types';
import type { SubmissionDetailView } from '../model/activity.views';
import { SubmissionLookupService } from './submission-lookup.service';

/**
 * Submits a member's own claim into the review queue (draft or changes-requested →
 * submitted), covering both the first submission and a resubmission after changes
 * were requested. The optimistic transition is audited and emits the versioned,
 * privacy-safe `ActivitySubmitted` outbox event in the same transaction.
 */
@Injectable()
export class SubmitSubmissionUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly lookup: SubmissionLookupService,
    private readonly submissions: ActivitySubmissionRepository,
    private readonly buddies: ActivityBuddyRepository,
    private readonly evidence: ActivityEvidenceRepository,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    submissionId: string,
    command: SubmissionVersionCommand,
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
    command: SubmissionVersionCommand,
  ): Promise<SubmissionDetailView> {
    const current = await this.lookup.requireForWrite(tx, teamId, submissionId);
    this.lookup.requireOwner(current, actor.userId);
    if (!canSubmitSubmission(current.status)) {
      throw new ActivityInvalidTransitionError();
    }
    const submitted = await this.transition(
      tx,
      actor,
      teamId,
      submissionId,
      command,
    );
    return this.finish(tx, actor, submitted);
  }

  private async transition(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    submissionId: string,
    command: SubmissionVersionCommand,
  ): Promise<ActivitySubmission> {
    const submitted = await this.submissions.applyStatusChange(
      tx,
      buildStatusChange(
        submissionId,
        teamId,
        command.expectedRecordVersion,
        SubmissionStatus.Submitted,
        actor.userId,
        this.clock.now(),
      ),
    );
    if (submitted === null) {
      throw new ActivityVersionConflictError();
    }
    return submitted;
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    submission: ActivitySubmission,
  ): Promise<SubmissionDetailView> {
    const buddies = await this.buddies.listForSubmission(tx, submission.id);
    const evidenceCount = await this.evidence.countForSubmission(
      tx,
      submission.id,
    );
    await this.audit.record(
      tx,
      buildSubmissionAudit(
        SUBMISSION_SUBMITTED_ACTION,
        actor.userId,
        submission,
      ),
    );
    await this.events.enqueue(
      tx,
      buildActivitySubmittedEvent(submission, buddies.length),
    );
    return toSubmissionDetailView({ submission, buddies, evidenceCount });
  }
}
