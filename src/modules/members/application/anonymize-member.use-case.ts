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

import { canTransition } from '../domain/membership-lifecycle.state-machine';
import { InvalidTransitionError } from '../errors/invalid-transition.error';
import { OptimisticConflictError } from '../errors/optimistic-conflict.error';
import { MemberAliasRepository } from '../infrastructure/member-alias.repository';
import { MemberAuditRepository } from '../infrastructure/member-audit.repository';
import { MemberProfileRepository } from '../infrastructure/member-profile.repository';
import { MembershipRepository } from '../infrastructure/membership.repository';
import { StatusEventRepository } from '../infrastructure/status-event.repository';
import {
  ANONYMIZED_NAME,
  MEMBER_ANONYMIZED_EVENT,
} from '../model/members.constants';
import { MembershipStatus } from '../model/members.enums';
import type {
  Membership,
  MembershipStatusChange,
  NewAuditEvent,
  NewStatusEvent,
  TransitionCommand,
} from '../model/members.types';
import { MemberLookupService } from './member-lookup.service';

/**
 * Anonymizes a membership: a privileged retention action, not ordinary deletion.
 * The membership row persists (historical references stay valid) but every
 * restricted profile field is redacted and all aliases are soft-removed, in one
 * transaction with an immutable status event and audit. Anonymized is terminal.
 */
@Injectable()
export class AnonymizeMemberUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly lookup: MemberLookupService,
    private readonly memberships: MembershipRepository,
    private readonly profiles: MemberProfileRepository,
    private readonly aliases: MemberAliasRepository,
    private readonly events: StatusEventRepository,
    private readonly audit: MemberAuditRepository,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    membershipId: string,
    command: TransitionCommand,
  ): Promise<Membership> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, teamId, membershipId, command),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    membershipId: string,
    command: TransitionCommand,
  ): Promise<Membership> {
    const current = await this.lookup.requireMembership(
      scope,
      teamId,
      membershipId,
    );
    if (!canTransition(current.status, MembershipStatus.Anonymized)) {
      throw new InvalidTransitionError();
    }
    const now = this.clock.now();
    const effectiveAt =
      command.effectiveAt === null ? now : new Date(command.effectiveAt);
    const updated = await this.memberships.applyStatusChange(
      scope,
      this.buildChange(current, command, effectiveAt, actor, now),
    );
    if (updated === null) {
      throw new OptimisticConflictError();
    }
    await this.redact(scope, current, actor, now);
    await this.events.append(
      scope,
      this.buildEvent(current, command, effectiveAt, actor, now),
    );
    await this.audit.append(scope, this.buildAudit(updated, actor, now));
    return updated;
  }

  private async redact(
    scope: TransactionScope,
    current: Membership,
    actor: AuthUserIdentity,
    now: Date,
  ): Promise<void> {
    await this.profiles.redact(scope, {
      membershipId: current.id,
      redactedName: ANONYMIZED_NAME,
      updatedBy: actor.userId,
      now,
    });
    await this.aliases.softDeleteAllForMembership(scope, current.id, now);
  }

  private buildChange(
    current: Membership,
    command: TransitionCommand,
    effectiveAt: Date,
    actor: AuthUserIdentity,
    now: Date,
  ): MembershipStatusChange {
    return {
      id: current.id,
      toStatus: MembershipStatus.Anonymized,
      reason: command.reason,
      statusEffectiveAt: effectiveAt,
      joinedAt: current.joinedAt,
      leftAt: current.leftAt,
      anonymizedAt: effectiveAt,
      updatedBy: actor.userId,
      expectedVersion: current.version,
      now,
    };
  }

  private buildEvent(
    current: Membership,
    command: TransitionCommand,
    effectiveAt: Date,
    actor: AuthUserIdentity,
    now: Date,
  ): NewStatusEvent {
    return {
      id: this.idGenerator.generate(),
      membershipId: current.id,
      fromStatus: current.status,
      toStatus: MembershipStatus.Anonymized,
      reason: command.reason,
      actorUserId: actor.userId,
      effectiveAt,
      now,
    };
  }

  private buildAudit(
    updated: Membership,
    actor: AuthUserIdentity,
    now: Date,
  ): NewAuditEvent {
    return {
      id: this.idGenerator.generate(),
      eventType: MEMBER_ANONYMIZED_EVENT,
      actorUserId: actor.userId,
      context: { membershipId: updated.id, teamId: updated.teamId },
      occurredAt: now,
    };
  }
}
