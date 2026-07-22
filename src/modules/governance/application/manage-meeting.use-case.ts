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
  canTransitionMeeting,
  meetingTargetOf,
} from '../domain/governance.state-machine';
import { GovernanceInvalidTransitionError } from '../errors/governance-invalid-transition.error';
import { GovernanceVersionConflictError } from '../errors/governance-version-conflict.error';
import { MeetingRepository } from '../infrastructure/meeting.repository';
import {
  buildMeetingAudit,
  buildMeetingStatusChange,
  buildNewMeeting,
} from '../lib/governance.builders';
import {
  MEETING_CREATED_ACTION,
  MEETING_TRANSITIONED_ACTION,
} from '../model/governance.constants';
import type {
  CreateMeetingCommand,
  GovernanceMeeting,
  MeetingTransitionCommand,
} from '../model/governance.types';
import { GovernanceLookupService } from './governance-lookup.service';

/**
 * Creates and moves governance meetings through their lifecycle (UN-603).
 * Minutes are attached when the meeting is minuted; approval stamps the approver
 * and freezes the record. Recurring meetings are marked by their recurrence
 * field; each occurrence is its own record.
 */
@Injectable()
export class ManageMeetingUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly ids: IdGeneratorPort,
    private readonly lookup: GovernanceLookupService,
    private readonly meetings: MeetingRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  create(
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateMeetingCommand,
  ): Promise<GovernanceMeeting> {
    return this.unitOfWork.runInTransaction(tx =>
      this.runCreate(tx, actor, teamId, command),
    );
  }

  transition(
    actor: AuthUserIdentity,
    teamId: string,
    meetingId: string,
    command: MeetingTransitionCommand,
  ): Promise<GovernanceMeeting> {
    return this.unitOfWork.runInTransaction(tx =>
      this.runTransition(tx, actor, teamId, meetingId, command),
    );
  }

  private async runCreate(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateMeetingCommand,
  ): Promise<GovernanceMeeting> {
    await this.lookup.requireTeam(tx, teamId);
    const meeting = await this.meetings.insert(
      tx,
      buildNewMeeting(
        this.ids.generate(),
        teamId,
        command.content,
        actor.userId,
        this.clock.now(),
      ),
    );
    await this.audit.record(
      tx,
      buildMeetingAudit(MEETING_CREATED_ACTION, actor.userId, meeting),
    );
    return meeting;
  }

  private async runTransition(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    meetingId: string,
    command: MeetingTransitionCommand,
  ): Promise<GovernanceMeeting> {
    const existing = await this.lookup.requireMeeting(tx, teamId, meetingId);
    const target = meetingTargetOf(command.transition);
    if (!canTransitionMeeting(existing.status, target)) {
      throw new GovernanceInvalidTransitionError();
    }
    const changed = await this.meetings.applyStatusChange(
      tx,
      buildMeetingStatusChange(
        existing,
        target,
        actor.userId,
        command,
        this.clock.now(),
      ),
    );
    if (changed === null) {
      throw new GovernanceVersionConflictError();
    }
    await this.audit.record(
      tx,
      buildMeetingAudit(MEETING_TRANSITIONED_ACTION, actor.userId, changed),
    );
    return changed;
  }
}
