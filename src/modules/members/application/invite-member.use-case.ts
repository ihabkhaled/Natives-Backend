import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import { ValidationError } from '@core/errors/validation.error';
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

import { MembershipConflictError } from '../errors/membership-conflict.error';
import { TeamScopeNotFoundError } from '../errors/team-scope-not-found.error';
import { MemberAuditRepository } from '../infrastructure/member-audit.repository';
import { MemberProfileRepository } from '../infrastructure/member-profile.repository';
import { MembershipRepository } from '../infrastructure/membership.repository';
import { StatusEventRepository } from '../infrastructure/status-event.repository';
import { TeamScopeRepository } from '../infrastructure/team-scope.repository';
import { isIsoCalendarDate } from '../lib/members.helpers';
import {
  MEMBER_INVITED_EVENT,
  PROFILE_INVALID_DATE_MESSAGE,
  PROFILE_INVALID_DATE_MESSAGE_KEY,
} from '../model/members.constants';
import { MembershipStatus } from '../model/members.enums';
import type {
  InviteMemberCommand,
  Membership,
  NewAuditEvent,
  NewMemberProfile,
  NewMembership,
  NewStatusEvent,
} from '../model/members.types';

/**
 * Invites a person into a team as an INVITED membership with a player profile,
 * an initial status-history event, and an audit row — all in one transaction.
 * The account link is optional so historical players/candidates need no login.
 * Enforces one non-terminal membership per person/team scope.
 */
@Injectable()
export class InviteMemberUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly teamScope: TeamScopeRepository,
    private readonly memberships: MembershipRepository,
    private readonly profiles: MemberProfileRepository,
    private readonly events: StatusEventRepository,
    private readonly audit: MemberAuditRepository,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    command: InviteMemberCommand,
  ): Promise<Membership> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, teamId, command),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: InviteMemberCommand,
  ): Promise<Membership> {
    if (!(await this.teamScope.activeTeamExists(scope, teamId))) {
      throw new TeamScopeNotFoundError();
    }
    this.assertValidDob(command.profile.dateOfBirth);
    await this.assertNoDuplicate(scope, teamId, command);
    const now = this.clock.now();
    const membership = await this.memberships.insert(
      scope,
      this.buildMembership(teamId, command, actor, now),
    );
    await this.profiles.insert(
      scope,
      this.buildProfile(membership, command, actor, now),
    );
    await this.events.append(scope, this.buildEvent(membership, actor, now));
    await this.audit.append(scope, this.buildAudit(membership, actor, now));
    return membership;
  }

  private assertValidDob(dateOfBirth: string | null): void {
    if (dateOfBirth !== null && !isIsoCalendarDate(dateOfBirth)) {
      throw new ValidationError(
        PROFILE_INVALID_DATE_MESSAGE,
        PROFILE_INVALID_DATE_MESSAGE_KEY,
      );
    }
  }

  private async assertNoDuplicate(
    scope: TransactionScope,
    teamId: string,
    command: InviteMemberCommand,
  ): Promise<void> {
    if (command.userId === null) {
      return;
    }
    const exists = await this.memberships.existsForUserScope(
      scope,
      teamId,
      command.userId,
      command.seasonId,
    );
    if (exists) {
      throw new MembershipConflictError();
    }
  }

  private buildMembership(
    teamId: string,
    command: InviteMemberCommand,
    actor: AuthUserIdentity,
    now: Date,
  ): NewMembership {
    return {
      id: this.idGenerator.generate(),
      teamId,
      seasonId: command.seasonId,
      userId: command.userId,
      status: MembershipStatus.Invited,
      statusEffectiveAt: now,
      createdBy: actor.userId,
      now,
    };
  }

  private buildProfile(
    membership: Membership,
    command: InviteMemberCommand,
    actor: AuthUserIdentity,
    now: Date,
  ): NewMemberProfile {
    return {
      id: this.idGenerator.generate(),
      membershipId: membership.id,
      teamId: membership.teamId,
      profile: command.profile,
      createdBy: actor.userId,
      now,
    };
  }

  private buildEvent(
    membership: Membership,
    actor: AuthUserIdentity,
    now: Date,
  ): NewStatusEvent {
    return {
      id: this.idGenerator.generate(),
      membershipId: membership.id,
      fromStatus: null,
      toStatus: MembershipStatus.Invited,
      reason: null,
      actorUserId: actor.userId,
      effectiveAt: now,
      now,
    };
  }

  private buildAudit(
    membership: Membership,
    actor: AuthUserIdentity,
    now: Date,
  ): NewAuditEvent {
    return {
      id: this.idGenerator.generate(),
      eventType: MEMBER_INVITED_EVENT,
      actorUserId: actor.userId,
      context: {
        membershipId: membership.id,
        teamId: membership.teamId,
        hasAccount: membership.userId !== null,
      },
      occurredAt: now,
    };
  }
}
