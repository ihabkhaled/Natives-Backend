import { ClockModule } from '@core/clock/clock.module';
import { IdGeneratorModule } from '@core/id-generator/id-generator.module';
import { AuthModule } from '@modules/auth';
import { MembersModule } from '@modules/members';
import { RbacModule } from '@modules/rbac';
import { Module } from '@nestjs/common';

import { CryptoSecureRandomAdapter } from './adapters/crypto-secure-random.adapter';
import { AuthController } from './api/auth.controller';
import { InvitationsController } from './api/invitations.controller';
import { PublicInvitationsController } from './api/public-invitations.controller';
import { AcceptInvitationUseCase } from './application/accept-invitation.use-case';
import { CreateInvitationUseCase } from './application/create-invitation.use-case';
import { ExpireInvitationsUseCase } from './application/expire-invitations.use-case';
import { GetCurrentPrincipalUseCase } from './application/get-current-principal.use-case';
import { GetInvitationDetailsUseCase } from './application/get-invitation-details.use-case';
import { ListSessionsUseCase } from './application/list-sessions.use-case';
import { LoginUseCase } from './application/login.use-case';
import { LogoutUseCase } from './application/logout.use-case';
import { LogoutAllUseCase } from './application/logout-all.use-case';
import { PrincipalMembershipsService } from './application/principal-memberships.service';
import { RefreshSessionUseCase } from './application/refresh-session.use-case';
import { RequestPasswordResetUseCase } from './application/request-password-reset.use-case';
import { ResendInvitationUseCase } from './application/resend-invitation.use-case';
import { ResetPasswordUseCase } from './application/reset-password.use-case';
import { RevokeInvitationUseCase } from './application/revoke-invitation.use-case';
import { RevokeOtherSessionsUseCase } from './application/revoke-other-sessions.use-case';
import { RevokeSessionUseCase } from './application/revoke-session.use-case';
import { SecurityAuditService } from './application/security-audit.service';
import { SessionIssuerService } from './application/session-issuer.service';
import { FailedLoginStateRepository } from './infrastructure/failed-login-state.repository';
import { InvitationRepository } from './infrastructure/invitation.repository';
import { PasswordCredentialRepository } from './infrastructure/password-credential.repository';
import { PasswordResetTokenRepository } from './infrastructure/password-reset-token.repository';
import { RefreshSessionRepository } from './infrastructure/refresh-session.repository';
import { SecurityEventRepository } from './infrastructure/security-event.repository';
import { UserRepository } from './infrastructure/user.repository';
import { SECURE_RANDOM_PORT } from './model/identity.constants';

/**
 * Identity bounded context: invitation-based accounts, authentication, refresh
 * session lifecycle, and recovery. Owns its persistence (raw SQL via the
 * UnitOfWorkPort), domain policies, and use cases. Depends on AuthModule for the
 * JWT and bcrypt ports, and on the clock/id-generator ports for determinism.
 * RbacModule supplies the core effective-permission resolver and the live role
 * assignments used to enrich a successful login; MembersModule supplies the
 * principal's own team/season memberships. Both arrive through their public
 * surfaces — no RBAC or members internals are imported here.
 */
@Module({
  imports: [
    AuthModule,
    RbacModule,
    MembersModule,
    ClockModule,
    IdGeneratorModule,
  ],
  controllers: [
    AuthController,
    InvitationsController,
    PublicInvitationsController,
  ],
  providers: [
    { provide: SECURE_RANDOM_PORT, useClass: CryptoSecureRandomAdapter },
    UserRepository,
    PasswordCredentialRepository,
    InvitationRepository,
    RefreshSessionRepository,
    PasswordResetTokenRepository,
    FailedLoginStateRepository,
    SecurityEventRepository,
    SecurityAuditService,
    PrincipalMembershipsService,
    SessionIssuerService,
    CreateInvitationUseCase,
    ResendInvitationUseCase,
    RevokeInvitationUseCase,
    ExpireInvitationsUseCase,
    AcceptInvitationUseCase,
    LoginUseCase,
    RefreshSessionUseCase,
    LogoutUseCase,
    LogoutAllUseCase,
    RequestPasswordResetUseCase,
    ResetPasswordUseCase,
    GetCurrentPrincipalUseCase,
    GetInvitationDetailsUseCase,
    ListSessionsUseCase,
    RevokeSessionUseCase,
    RevokeOtherSessionsUseCase,
  ],
})
export class IdentityModule {}
