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
import { EnsureRoleAssignmentService } from '@modules/rbac';
import { Inject, Injectable } from '@nestjs/common';
import { RbacRole } from '@shared/enums';

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
 * the invitation's team when it carries one), grants the default MEMBER role in
 * each linked team through the RBAC public surface, marks the invitation
 * consumed, audits it, and issues the first session — all in one transaction so
 * partial state can never persist. The invitee therefore lands with a working
 * team context: `/auth/me` carries the membership and the scoped permission
 * read returns the member grants.
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
    await this.audit.record(
      scope,
      SecurityEventType.InvitationAccepted,
      user.id,
      { invitationId: invitation.id, linkedMemberships: claimed.length },
    );
    return this.sessionIssuer.issue(
      scope,
      user,
      command.deviceLabel,
      this.idGenerator.generate(),
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
   * account and grant the default MEMBER role in each linked team. Sequential:
   * the members surface guards duplicates within this same transaction.
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
    for (const membership of claimed) {
      await this.roleAssignments.ensureTeamRole(scope, {
        userId: user.id,
        roleKey: RbacRole.Member,
        teamId: membership.teamId,
        grantedBy: invitation.invitedBy,
        now,
      });
    }
    return claimed;
  }
}
