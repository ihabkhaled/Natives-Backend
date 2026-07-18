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
import { MemberAuditRepository } from '../infrastructure/member-audit.repository';
import { MembershipRepository } from '../infrastructure/membership.repository';
import { StatusEventRepository } from '../infrastructure/status-event.repository';
import { MEMBER_TRANSITIONED_EVENT } from '../model/members.constants';
import { MembershipStatus } from '../model/members.enums';
import type {
  Membership,
  MembershipStatusChange,
  NewAuditEvent,
  NewStatusEvent,
  TransitionCommand,
  TransitionContext,
} from '../model/members.types';
import { MemberLookupService } from './member-lookup.service';

/**
 * Applies a lifecycle transition (activate/deactivate/suspend/leave/archive/
 * restore) to a membership: validates the move via the state machine, stamps the
 * effective time and actor, records an immutable status-history event, and audits
 * — all in one transaction, guarded by optimistic concurrency. Deactivation and
 * suspension remove the member's ability to act while preserving their history.
 */
@Injectable()
export class TransitionMemberUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly lookup: MemberLookupService,
    private readonly memberships: MembershipRepository,
    private readonly events: StatusEventRepository,
    private readonly audit: MemberAuditRepository,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    membershipId: string,
    targetStatus: MembershipStatus,
    command: TransitionCommand,
  ): Promise<Membership> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, teamId, membershipId, targetStatus, command),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    membershipId: string,
    targetStatus: MembershipStatus,
    command: TransitionCommand,
  ): Promise<Membership> {
    const current = await this.lookup.requireMembership(
      scope,
      teamId,
      membershipId,
    );
    if (!canTransition(current.status, targetStatus)) {
      throw new InvalidTransitionError();
    }
    const context = this.buildContext(current, targetStatus, command, actor);
    const updated = await this.apply(scope, context);
    await this.record(scope, context, updated);
    return updated;
  }

  private buildContext(
    current: Membership,
    targetStatus: MembershipStatus,
    command: TransitionCommand,
    actor: AuthUserIdentity,
  ): TransitionContext {
    const now = this.clock.now();
    return {
      current,
      targetStatus,
      reason: command.reason,
      effectiveAt:
        command.effectiveAt === null ? now : new Date(command.effectiveAt),
      actorUserId: actor.userId,
      now,
    };
  }

  private async apply(
    scope: TransactionScope,
    context: TransitionContext,
  ): Promise<Membership> {
    const updated = await this.memberships.applyStatusChange(
      scope,
      this.buildChange(context),
    );
    if (updated === null) {
      throw new OptimisticConflictError();
    }
    return updated;
  }

  private async record(
    scope: TransactionScope,
    context: TransitionContext,
    updated: Membership,
  ): Promise<void> {
    await this.events.append(scope, this.buildEvent(context));
    await this.audit.append(scope, this.buildAudit(context, updated));
  }

  private buildChange(context: TransitionContext): MembershipStatusChange {
    const { current, targetStatus, effectiveAt } = context;
    return {
      id: current.id,
      toStatus: targetStatus,
      reason: context.reason,
      statusEffectiveAt: effectiveAt,
      joinedAt: this.resolveJoinedAt(current, targetStatus, effectiveAt),
      leftAt:
        targetStatus === MembershipStatus.Left ? effectiveAt : current.leftAt,
      anonymizedAt: current.anonymizedAt,
      updatedBy: context.actorUserId,
      expectedVersion: current.version,
      now: context.now,
    };
  }

  private resolveJoinedAt(
    current: Membership,
    targetStatus: MembershipStatus,
    effectiveAt: Date,
  ): Date | null {
    if (targetStatus === MembershipStatus.Active && current.joinedAt === null) {
      return effectiveAt;
    }
    return current.joinedAt;
  }

  private buildEvent(context: TransitionContext): NewStatusEvent {
    return {
      id: this.idGenerator.generate(),
      membershipId: context.current.id,
      fromStatus: context.current.status,
      toStatus: context.targetStatus,
      reason: context.reason,
      actorUserId: context.actorUserId,
      effectiveAt: context.effectiveAt,
      now: context.now,
    };
  }

  private buildAudit(
    context: TransitionContext,
    updated: Membership,
  ): NewAuditEvent {
    return {
      id: this.idGenerator.generate(),
      eventType: MEMBER_TRANSITIONED_EVENT,
      actorUserId: context.actorUserId,
      context: {
        membershipId: updated.id,
        teamId: updated.teamId,
        from: context.current.status,
        to: updated.status,
      },
      occurredAt: context.now,
    };
  }
}
