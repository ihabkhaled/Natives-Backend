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

import { findJerseyConflict } from '../domain/jersey.policy';
import { classifyAge } from '../domain/member-age.policy';
import { shapeMemberView } from '../domain/member-privacy.policy';
import {
  canEditProfile,
  canSelfEditProfile,
} from '../domain/membership-lifecycle.state-machine';
import { JerseyConflictError } from '../errors/jersey-conflict.error';
import { OptimisticConflictError } from '../errors/optimistic-conflict.error';
import { ProfileForbiddenError } from '../errors/profile-forbidden.error';
import { MemberAuditRepository } from '../infrastructure/member-audit.repository';
import { MemberProfileRepository } from '../infrastructure/member-profile.repository';
import { isIsoCalendarDate } from '../lib/members.helpers';
import {
  JERSEY_SCAN_LIMIT,
  MEMBER_PROFILE_UPDATED_EVENT,
  PROFILE_INVALID_DATE_MESSAGE,
  PROFILE_INVALID_DATE_MESSAGE_KEY,
} from '../model/members.constants';
import type {
  MemberAccess,
  MemberRecord,
  Membership,
  MemberView,
  NewAuditEvent,
  UpdateProfileCommand,
} from '../model/members.types';
import { MemberAccessService } from './member-access.service';
import { MemberLookupService } from './member-lookup.service';

/**
 * Updates a player profile. Enforces the ownership-or-elevated invariant (the
 * member editing their own active profile, or a lifecycle manager) via the
 * resolver, rejects anonymized (immutable) profiles, enforces scoped active
 * jersey uniqueness, and guards the write with optimistic concurrency. Returns
 * the profile shaped for the actor's resolved audience — no over-exposure.
 */
@Injectable()
export class UpdateMemberProfileUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly lookup: MemberLookupService,
    private readonly access: MemberAccessService,
    private readonly profiles: MemberProfileRepository,
    private readonly audit: MemberAuditRepository,
  ) {}

  async execute(
    actor: AuthUserIdentity,
    teamId: string,
    membershipId: string,
    command: UpdateProfileCommand,
  ): Promise<MemberView> {
    const membership = await this.loadMembership(teamId, membershipId);
    const access = await this.access.resolveAccess(actor, teamId, membership);
    this.assertCanEdit(membership, access);
    this.assertValidDob(command.profile.dateOfBirth);
    const record = await this.applyUpdate(actor, membership, command);
    const age = classifyAge(record.profile.dateOfBirth, this.clock.now());
    return shapeMemberView(record, access.viewer, age);
  }

  private loadMembership(
    teamId: string,
    membershipId: string,
  ): Promise<Membership> {
    return this.unitOfWork.runInTransaction(scope =>
      this.lookup.requireMembership(scope, teamId, membershipId),
    );
  }

  private assertCanEdit(membership: Membership, access: MemberAccess): void {
    if (!access.canManage && !access.viewer.isSelf) {
      throw new ProfileForbiddenError();
    }
    if (!canEditProfile(membership.status)) {
      throw new ProfileForbiddenError();
    }
    if (
      access.viewer.isSelf &&
      !access.canManage &&
      !canSelfEditProfile(membership.status)
    ) {
      throw new ProfileForbiddenError();
    }
  }

  private assertValidDob(dateOfBirth: string | null): void {
    if (dateOfBirth !== null && !isIsoCalendarDate(dateOfBirth)) {
      throw new ValidationError(
        PROFILE_INVALID_DATE_MESSAGE,
        PROFILE_INVALID_DATE_MESSAGE_KEY,
      );
    }
  }

  private applyUpdate(
    actor: AuthUserIdentity,
    membership: Membership,
    command: UpdateProfileCommand,
  ): Promise<MemberRecord> {
    return this.unitOfWork.runInTransaction(async scope => {
      await this.assertJerseyFree(scope, membership, command);
      const now = this.clock.now();
      const profile = await this.profiles.update(scope, {
        membershipId: membership.id,
        profile: command.profile,
        updatedBy: actor.userId,
        expectedVersion: command.expectedVersion,
        now,
      });
      if (profile === null) {
        throw new OptimisticConflictError();
      }
      await this.audit.append(scope, this.buildAudit(membership, actor, now));
      return { membership, profile };
    });
  }

  private async assertJerseyFree(
    scope: TransactionScope,
    membership: Membership,
    command: UpdateProfileCommand,
  ): Promise<void> {
    const jersey = command.profile.jerseyNumber;
    if (jersey === null) {
      return;
    }
    const reservations = await this.profiles.listActiveJerseys(
      scope,
      membership.teamId,
      membership.seasonId,
      JERSEY_SCAN_LIMIT,
    );
    if (findJerseyConflict(reservations, jersey, membership.id) !== null) {
      throw new JerseyConflictError();
    }
  }

  private buildAudit(
    membership: Membership,
    actor: AuthUserIdentity,
    now: Date,
  ): NewAuditEvent {
    return {
      id: this.idGenerator.generate(),
      eventType: MEMBER_PROFILE_UPDATED_EVENT,
      actorUserId: actor.userId,
      context: { membershipId: membership.id, teamId: membership.teamId },
      occurredAt: now,
    };
  }
}
