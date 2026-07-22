import {
  ID_GENERATOR_PORT,
  type IdGeneratorPort,
} from '@core/id-generator/id-generator.port';
import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { canTransition } from '../domain/membership-lifecycle.state-machine';
import { MemberAuditRepository } from '../infrastructure/member-audit.repository';
import { MembershipRepository } from '../infrastructure/membership.repository';
import { StatusEventRepository } from '../infrastructure/status-event.repository';
import { MEMBER_ACCOUNT_LINKED_EVENT } from '../model/members.constants';
import { MembershipStatus } from '../model/members.enums';
import type {
  ClaimedMembership,
  ClaimInvitedMembershipsCommand,
  Membership,
  MembershipClaim,
  NewAuditEvent,
  NewStatusEvent,
} from '../model/members.types';

/**
 * Public members surface for invitation acceptance: link every invited,
 * still-unlinked membership whose profile carries the invitation email to the
 * freshly created account, and activate it. Each claim is a guarded write
 * (state machine + optimistic version + duplicate-scope check) that records the
 * invited→active status-history event and an audit row — inside the CALLER'S
 * transaction scope, so account creation, membership linkage, and the default
 * role grant commit or roll back together. Consumed by the identity module.
 */
@Injectable()
export class ClaimInvitedMembershipsService {
  constructor(
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly memberships: MembershipRepository,
    private readonly events: StatusEventRepository,
    private readonly audit: MemberAuditRepository,
  ) {}

  async claim(
    scope: TransactionScope,
    command: ClaimInvitedMembershipsCommand,
  ): Promise<readonly ClaimedMembership[]> {
    const invited = await this.memberships.listInvitedUnlinkedByEmail(
      scope,
      command.email,
      command.teamId,
    );
    const claimed: ClaimedMembership[] = [];
    // Sequential on purpose: each duplicate-scope guard must observe the
    // memberships linked by the previous iteration in this same transaction.
    for (const membership of invited) {
      const result = await this.claimOne(scope, membership, command);
      if (result !== null) {
        claimed.push(result);
      }
    }
    return claimed;
  }

  private async claimOne(
    scope: TransactionScope,
    membership: Membership,
    command: ClaimInvitedMembershipsCommand,
  ): Promise<ClaimedMembership | null> {
    if (!(await this.isClaimable(scope, membership, command))) {
      return null;
    }
    const updated = await this.memberships.linkUserAndActivate(
      scope,
      this.buildClaim(membership, command),
    );
    if (updated === null) {
      return null;
    }
    await this.record(scope, membership, updated, command);
    return this.toClaimed(updated);
  }

  private toClaimed(updated: Membership): ClaimedMembership {
    return {
      membershipId: updated.id,
      teamId: updated.teamId,
      seasonId: updated.seasonId,
    };
  }

  private buildClaim(
    membership: Membership,
    command: ClaimInvitedMembershipsCommand,
  ): MembershipClaim {
    return {
      id: membership.id,
      userId: command.userId,
      statusEffectiveAt: command.now,
      expectedVersion: membership.version,
      now: command.now,
    };
  }

  private async record(
    scope: TransactionScope,
    membership: Membership,
    updated: Membership,
    command: ClaimInvitedMembershipsCommand,
  ): Promise<void> {
    await this.events.append(scope, this.buildEvent(membership, command));
    await this.audit.append(scope, this.buildAudit(updated, command));
  }

  /**
   * A membership is claimable when the lifecycle allows invited→active and the
   * account does not already hold a live membership in that team/season scope
   * (the partial unique index would reject the link).
   */
  private async isClaimable(
    scope: TransactionScope,
    membership: Membership,
    command: ClaimInvitedMembershipsCommand,
  ): Promise<boolean> {
    if (!canTransition(membership.status, MembershipStatus.Active)) {
      return false;
    }
    const duplicate = await this.memberships.existsForUserScope(
      scope,
      membership.teamId,
      command.userId,
      membership.seasonId,
    );
    return !duplicate;
  }

  private buildEvent(
    membership: Membership,
    command: ClaimInvitedMembershipsCommand,
  ): NewStatusEvent {
    return {
      id: this.idGenerator.generate(),
      membershipId: membership.id,
      fromStatus: membership.status,
      toStatus: MembershipStatus.Active,
      reason: null,
      actorUserId: command.userId,
      effectiveAt: command.now,
      now: command.now,
    };
  }

  private buildAudit(
    updated: Membership,
    command: ClaimInvitedMembershipsCommand,
  ): NewAuditEvent {
    return {
      id: this.idGenerator.generate(),
      eventType: MEMBER_ACCOUNT_LINKED_EVENT,
      actorUserId: command.userId,
      context: {
        membershipId: updated.id,
        teamId: updated.teamId,
        from: MembershipStatus.Invited,
        to: updated.status,
      },
      occurredAt: command.now,
    };
  }
}
