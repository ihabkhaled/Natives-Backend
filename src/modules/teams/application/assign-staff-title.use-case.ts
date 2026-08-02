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
import { Inject, Injectable } from '@nestjs/common';

import { isAssignableStaffTitle } from '../domain/staff-assignment.policy';
import { SlugConflictError } from '../errors/slug-conflict.error';
import { StaffMembershipNotFoundError } from '../errors/staff-membership-not-found.error';
import { StaffTitleNotFoundError } from '../errors/staff-title-not-found.error';
import { CatalogRepository } from '../infrastructure/catalog.repository';
import { StaffAssignmentRepository } from '../infrastructure/staff-assignment.repository';
import { TeamAuditRepository } from '../infrastructure/team-audit.repository';
import { STAFF_ASSIGNMENT_CREATED_EVENT } from '../model/teams.constants';
import type {
  CreateStaffAssignmentCommand,
  NewAuditEvent,
  NewStaffAssignment,
  StaffAssignment,
} from '../model/teams.types';
import { TeamLookupService } from './team-lookup.service';

/**
 * Assigns a staff title (a `staff_title` reference-catalog entry) to a
 * membership within a team. A person may hold multiple titles: each call adds
 * one more assignment row, guarded against a duplicate concurrently-active
 * assignment of the same title to the same person.
 */
@Injectable()
export class AssignStaffTitleUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly teamLookup: TeamLookupService,
    private readonly catalog: CatalogRepository,
    private readonly staff: StaffAssignmentRepository,
    private readonly audit: TeamAuditRepository,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateStaffAssignmentCommand,
  ): Promise<StaffAssignment> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, teamId, command),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateStaffAssignmentCommand,
  ): Promise<StaffAssignment> {
    await this.teamLookup.requireActive(scope, teamId);
    await this.requireMembership(scope, teamId, command.membershipId);
    await this.requireStaffTitle(scope, teamId, command.titleEntryId);
    if (
      await this.staff.existsActive(
        scope,
        teamId,
        command.membershipId,
        command.titleEntryId,
      )
    ) {
      throw new SlugConflictError();
    }
    const now = this.clock.now();
    const assignment = await this.staff.insert(
      scope,
      this.buildAssignment(teamId, command, actor, now),
    );
    await this.audit.append(scope, this.buildAudit(actor, assignment, now));
    return assignment;
  }

  private async requireMembership(
    scope: TransactionScope,
    teamId: string,
    membershipId: string,
  ): Promise<void> {
    const exists = await this.staff.membershipExistsInTeam(
      scope,
      teamId,
      membershipId,
    );
    if (!exists) {
      throw new StaffMembershipNotFoundError();
    }
  }

  private async requireStaffTitle(
    scope: TransactionScope,
    teamId: string,
    titleEntryId: string,
  ): Promise<void> {
    const entry = await this.catalog.findByIdInTeam(
      scope,
      teamId,
      titleEntryId,
    );
    if (entry === null || !isAssignableStaffTitle(entry)) {
      throw new StaffTitleNotFoundError();
    }
  }

  private buildAssignment(
    teamId: string,
    command: CreateStaffAssignmentCommand,
    actor: AuthUserIdentity,
    now: Date,
  ): NewStaffAssignment {
    return {
      id: this.idGenerator.generate(),
      teamId,
      membershipId: command.membershipId,
      titleEntryId: command.titleEntryId,
      photoUrl: command.photoUrl,
      createdBy: actor.userId,
      now,
    };
  }

  private buildAudit(
    actor: AuthUserIdentity,
    assignment: StaffAssignment,
    now: Date,
  ): NewAuditEvent {
    return {
      id: this.idGenerator.generate(),
      eventType: STAFF_ASSIGNMENT_CREATED_EVENT,
      actorUserId: actor.userId,
      context: {
        teamId: assignment.teamId,
        membershipId: assignment.membershipId,
        titleEntryId: assignment.titleEntryId,
        assignmentId: assignment.id,
      },
      occurredAt: now,
    };
  }
}
