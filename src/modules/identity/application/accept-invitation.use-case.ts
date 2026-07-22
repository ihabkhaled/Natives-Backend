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
import { PASSWORD_HASH_PORT, type PasswordHashPort } from '@modules/auth';
import {
  type ClaimedMembership,
  ClaimInvitedMembershipsService,
} from '@modules/members';
import {
  EnsureRoleAssignmentService,
  ProtectedRoleError,
  RoleNotFoundError,
} from '@modules/rbac';
import { Inject, Injectable } from '@nestjs/common';

import { isInvitationAcceptable } from '../domain/invitation.policy';
import { InvitationInvalidError } from '../errors/invitation-invalid.error';
import { InvitationRepository } from '../infrastructure/invitation.repository';
import { PasswordCredentialRepository } from '../infrastructure/password-credential.repository';
import { UserRepository } from '../infrastructure/user.repository';
import { hashOpaqueToken } from '../lib/token-hash';
import { SecurityEventType, UserStatus } from '../model/identity.enums';
import type {
  AcceptInvitationCommand,
  Invitation,
  IssuedSession,
  User,
} from '../model/identity.types';
import { SecurityAuditService } from './security-audit.service';
import { SessionIssuerService } from './session-issuer.service';

/**
 * Accepts an invitation atomically: verifies the single-use token (locked FOR
 * UPDATE), creates the user + password credential, activates the account, links
 * and activates every invited membership pre-created for this email (scoped to
 * the invitation's team when it carries one), grants the INVITED team role
 * (`team_role_key`, ceiling-validated at invite time) in each linked team
 * through the RBAC public surface, marks the invitation consumed, audits it,
 * and issues the first session — all in one transaction so partial state can
 * never persist. The role is re-validated at accept time: if it was removed or
 * reclassified as protected between invite and accept, acceptance fails as an
 * invalid invitation rather than silently granting something else. The invitee
 * therefore lands with a working team context: `/auth/me` carries the
 * membership and the scoped permission read returns the invited role's grants.
 */
@Injectable()
export class AcceptInvitationUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    @Inject(PASSWORD_HASH_PORT)
    private readonly passwordHash: PasswordHashPort,
    private readonly users: UserRepository,
    private readonly credentials: PasswordCredentialRepository,
    private readonly invitations: InvitationRepository,
    private readonly membershipClaims: ClaimInvitedMembershipsService,
    private readonly roleAssignments: EnsureRoleAssignmentService,
    private readonly audit: SecurityAuditService,
    private readonly sessionIssuer: SessionIssuerService,
  ) {}

  execute(command: AcceptInvitationCommand): Promise<IssuedSession> {
    return this.unitOfWork.runInTransaction(scope => this.run(scope, command));
  }

  private async run(
    scope: TransactionScope,
    command: AcceptInvitationCommand,
  ): Promise<IssuedSession> {
    const now = this.clock.now();
    const invitation = await this.invitations.findByTokenHashForUpdate(
      scope,
      hashOpaqueToken(command.token),
    );
    if (invitation === null || !isInvitationAcceptable(invitation, now)) {
      throw new InvitationInvalidError();
    }
    const user = await this.createAccount(scope, invitation, command, now);
    const claimed = await this.linkMemberships(scope, invitation, user, now);
    await this.invitations.markAccepted(scope, invitation.id, now);
    await this.recordAudit(scope, invitation, user, claimed, now);
    return this.sessionIssuer.issue(
      scope,
      user,
      command.deviceLabel,
      this.idGenerator.generate(),
    );
  }

  /**
   * Audit the acceptance with everything prompt 100 requires recoverable:
   * inviter, granted role, team, membership, and the effective instant. For a
   * platform-scoped invitation that linked several memberships, the first
   * linked membership/team is recorded alongside the total count.
   */
  private async recordAudit(
    scope: TransactionScope,
    invitation: Invitation,
    user: User,
    claimed: readonly ClaimedMembership[],
    now: Date,
  ): Promise<void> {
    const first = claimed[0];
    await this.audit.record(
      scope,
      SecurityEventType.InvitationAccepted,
      user.id,
      {
        invitationId: invitation.id,
        linkedMemberships: claimed.length,
        roleKey: invitation.teamRoleKey,
        effectiveFrom: now.toISOString(),
        ...(invitation.invitedBy === null
          ? {}
          : { invitedBy: invitation.invitedBy }),
        ...(first === undefined
          ? {}
          : { membershipId: first.membershipId, teamId: first.teamId }),
      },
    );
  }

  private async createAccount(
    scope: TransactionScope,
    invitation: Invitation,
    command: AcceptInvitationCommand,
    now: Date,
  ): Promise<User> {
    const user = await this.users.insert(scope, {
      id: this.idGenerator.generate(),
      email: invitation.email,
      role: invitation.role,
      status: UserStatus.Active,
      displayName: command.displayName,
      now,
    });
    const passwordHash = await this.passwordHash.hash(command.password);
    await this.credentials.insert(
      scope,
      this.idGenerator.generate(),
      user.id,
      passwordHash,
      now,
    );
    return user;
  }

  /**
   * Link the invited membership(s) pre-created for this email to the new
   * account and grant the INVITED team role in each linked team. Sequential:
   * the members surface guards duplicates within this same transaction. An
   * unknown or protected role at accept time invalidates the invitation — the
   * promise it carried is no longer honorable, and granting less silently
   * would be a lie.
   */
  private async linkMemberships(
    scope: TransactionScope,
    invitation: Invitation,
    user: User,
    now: Date,
  ): Promise<readonly ClaimedMembership[]> {
    const claimed = await this.membershipClaims.claim(scope, {
      email: invitation.email,
      teamId: invitation.teamId,
      userId: user.id,
      now,
    });
    try {
      for (const membership of claimed) {
        await this.roleAssignments.ensureTeamRole(scope, {
          userId: user.id,
          roleKey: invitation.teamRoleKey,
          teamId: membership.teamId,
          grantedBy: invitation.invitedBy,
          now,
        });
      }
    } catch (error) {
      throw this.toAcceptError(error);
    }
    return claimed;
  }

  private toAcceptError(error: unknown): Error {
    if (
      error instanceof RoleNotFoundError ||
      error instanceof ProtectedRoleError
    ) {
      return new InvitationInvalidError();
    }
    return error instanceof Error ? error : new Error(String(error));
  }
}
