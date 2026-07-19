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

import {
  assertBuddyMemberships,
  resolveInitialBuddyStatus,
} from '../domain/activity-buddy.policy';
import { assertSubmissionContent } from '../domain/activity-submission.policy';
import { ActivityDuplicateSubmissionError } from '../errors/activity-duplicate-submission.error';
import { ActivityBuddyRepository } from '../infrastructure/activity-buddy.repository';
import { ActivityEvidenceRepository } from '../infrastructure/activity-evidence.repository';
import { ActivitySubmissionRepository } from '../infrastructure/activity-submission.repository';
import {
  buildBuddyRows,
  buildEvidenceRows,
  buildNewSubmission,
  buildSubmissionAudit,
} from '../lib/activity.builders';
import { toCalendarDay } from '../lib/activity.helpers';
import { toSubmissionDetailView } from '../lib/activity.response.mapper';
import {
  BUDDY_CONFIRMATION_REQUIRED,
  SUBMISSION_CREATED_ACTION,
} from '../model/activities.constants';
import type {
  ActivitySubmission,
  CreateSubmissionCommand,
  SubmissionContent,
} from '../model/activity.types';
import type { SubmissionDetailView } from '../model/activity.views';
import { ActivityCatalogService } from './activity-catalog.service';
import { ActivityScopeService } from './activity-scope.service';

/**
 * Creates a DRAFT external-training submission for the acting member. Identity and
 * membership are resolved from the token (never the body), so a member can only
 * submit for themselves. Validates scope, the active activity type, server-side
 * content bounds, buddy membership, and duplicate claims, then writes the
 * submission, its pending buddy credits, its private evidence, and an audit entry
 * in one transaction. A draft awards no points — it is a claim only.
 */
@Injectable()
export class CreateSubmissionUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly scope: ActivityScopeService,
    private readonly catalog: ActivityCatalogService,
    private readonly submissions: ActivitySubmissionRepository,
    private readonly buddies: ActivityBuddyRepository,
    private readonly evidence: ActivityEvidenceRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateSubmissionCommand,
  ): Promise<SubmissionDetailView> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateSubmissionCommand,
  ): Promise<SubmissionDetailView> {
    await this.scope.validate(tx, teamId, command.content.seasonId);
    const membershipId = await this.scope.resolveActingMembership(
      tx,
      teamId,
      actor.userId,
    );
    const type = await this.catalog.requireActiveType(
      tx,
      command.content.activityTypeId,
    );
    assertSubmissionContent(
      command.content,
      type,
      toCalendarDay(this.clock.now()),
    );
    assertBuddyMemberships(command.buddyMembershipIds, membershipId);
    await this.scope.requireBuddyMemberships(
      tx,
      teamId,
      command.buddyMembershipIds,
    );
    await this.assertNotDuplicate(tx, membershipId, command.content);
    const submission = await this.persist(
      tx,
      actor,
      teamId,
      membershipId,
      command,
    );
    return this.finish(tx, actor, submission, command);
  }

  private async assertNotDuplicate(
    tx: TransactionScope,
    membershipId: string,
    content: SubmissionContent,
  ): Promise<void> {
    const exists = await this.submissions.existsLiveForMember(
      tx,
      membershipId,
      content.activityTypeId,
      content.performedOn,
      null,
    );
    if (exists) {
      throw new ActivityDuplicateSubmissionError();
    }
  }

  private persist(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    membershipId: string,
    command: CreateSubmissionCommand,
  ): Promise<ActivitySubmission> {
    return this.submissions.insert(
      tx,
      buildNewSubmission(
        this.idGenerator.generate(),
        teamId,
        membershipId,
        actor.userId,
        command,
        this.clock.now(),
      ),
    );
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    submission: ActivitySubmission,
    command: CreateSubmissionCommand,
  ): Promise<SubmissionDetailView> {
    await this.buddies.insertMany(
      tx,
      buildBuddyRows(
        submission.id,
        command.buddyMembershipIds,
        resolveInitialBuddyStatus(BUDDY_CONFIRMATION_REQUIRED),
        () => this.idGenerator.generate(),
        this.clock.now(),
      ),
    );
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
      buildSubmissionAudit(SUBMISSION_CREATED_ACTION, actor.userId, submission),
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
