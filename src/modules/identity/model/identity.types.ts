import type { Role } from '@shared/enums';

import type {
  AccountState,
  InvitationStatus,
  SecurityEventType,
  UserStatus,
} from './identity.enums';

// --- Secure-random port ------------------------------------------------------

/**
 * Cryptographically secure opaque-token generator. Injected so token generation
 * is deterministic (mockable) in tests while production uses node:crypto.
 */
export interface SecureRandomPort {
  generateToken(): string;
}

// --- Domain aggregates -------------------------------------------------------

export interface User {
  readonly id: string;
  readonly email: string;
  readonly role: Role;
  readonly status: UserStatus;
  readonly displayName: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
  readonly version: number;
}

export interface UserWithCredential {
  readonly user: User;
  readonly passwordHash: string | null;
}

export interface Invitation {
  readonly id: string;
  readonly email: string;
  readonly invitedBy: string | null;
  readonly role: Role;
  readonly status: InvitationStatus;
  readonly expiresAt: Date;
  readonly acceptedAt: Date | null;
  readonly revokedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface PublicInvitationRecord extends Invitation {
  readonly inviterName: string | null;
}

export interface RefreshSession {
  readonly id: string;
  readonly userId: string;
  readonly familyId: string;
  readonly deviceLabel: string | null;
  readonly issuedAt: Date;
  readonly expiresAt: Date;
  readonly rotatedAt: Date | null;
  readonly revokedAt: Date | null;
  readonly reuseDetectedAt: Date | null;
}

export interface PasswordResetToken {
  readonly id: string;
  readonly userId: string;
  readonly expiresAt: Date;
  readonly consumedAt: Date | null;
}

export interface FailedLoginState {
  readonly id: string;
  readonly email: string;
  readonly attemptCount: number;
  readonly firstAttemptAt: Date;
  readonly lockedUntil: Date | null;
}

// --- Persistence write models ------------------------------------------------

export interface NewUser {
  readonly id: string;
  readonly email: string;
  readonly role: Role;
  readonly status: UserStatus;
  readonly displayName: string | null;
  readonly now: Date;
}

export interface NewInvitation {
  readonly id: string;
  readonly email: string;
  readonly tokenHash: string;
  readonly invitedBy: string | null;
  readonly role: Role;
  readonly expiresAt: Date;
  readonly now: Date;
}

export interface NewRefreshSession {
  readonly id: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly familyId: string;
  readonly deviceLabel: string | null;
  readonly issuedAt: Date;
  readonly expiresAt: Date;
}

export interface NewPasswordResetToken {
  readonly id: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly now: Date;
}

export interface NewFailedLoginState {
  readonly id: string;
  readonly email: string;
  readonly attemptCount: number;
  readonly firstAttemptAt: Date;
  readonly lockedUntil: Date | null;
}

export interface FailedLoginUpdate {
  readonly id: string;
  readonly attemptCount: number;
  readonly firstAttemptAt: Date;
  readonly lockedUntil: Date | null;
  readonly now: Date;
}

export interface FailedLoginDecision {
  readonly attemptCount: number;
  readonly firstAttemptAt: Date;
  readonly lockedUntil: Date | null;
  readonly locked: boolean;
}

export interface RefreshSessionDraft {
  readonly token: string;
  readonly record: NewRefreshSession;
}

export interface NewSecurityEvent {
  readonly id: string;
  readonly eventType: SecurityEventType;
  readonly actorUserId: string | null;
  readonly context: Readonly<Record<string, string | number | boolean>>;
  readonly occurredAt: Date;
}

// --- Application command / result models -------------------------------------

export interface CreateInvitationCommand {
  readonly email: string;
  readonly role: Role;
  readonly invitedBy: string;
}

export interface AcceptInvitationCommand {
  readonly token: string;
  readonly password: string;
  readonly displayName: string | null;
  readonly deviceLabel: string | null;
}

export interface LoginCommand {
  readonly email: string;
  readonly password: string;
  readonly deviceLabel: string | null;
}

export interface RefreshCommand {
  readonly refreshToken: string;
  readonly deviceLabel: string | null;
}

export interface ResetPasswordCommand {
  readonly token: string;
  readonly password: string;
}

export interface IssuedSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly refreshTokenExpiresAt: Date;
  readonly userId: string;
}

export type SessionOutcome =
  | { readonly kind: 'issued'; readonly session: IssuedSession }
  | { readonly kind: 'denied' };

export type LoginOutcome =
  | {
      readonly kind: 'issued';
      readonly session: IssuedSession;
      readonly user: User;
    }
  | { readonly kind: 'denied' };

export interface AuthTokensPayload {
  readonly accessToken: string;
  readonly refreshToken: string;
}

export interface AuthMembershipPayload {
  readonly teamId: string;
  readonly teamName: string;
  readonly seasonId: string;
  readonly seasonName: string;
}

export interface AuthUserPayload {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly permissions: readonly string[];
  readonly accountState: AccountState;
  readonly onboardingComplete: boolean;
  readonly memberships: readonly AuthMembershipPayload[];
}

export interface LoginResponse {
  readonly tokens: AuthTokensPayload;
  readonly user: AuthUserPayload;
}

export interface Principal {
  readonly userId: string;
  readonly email: string;
  readonly role: Role;
  readonly status: UserStatus;
}

export interface Acknowledgement {
  readonly message: string;
}

export interface InvitationSummary {
  readonly id: string;
  readonly email: string;
  readonly role: Role;
  readonly status: InvitationStatus;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}

export interface SessionListQuery {
  readonly limit: number;
  readonly offset: number;
}

export interface RefreshSessionPage {
  readonly items: readonly RefreshSession[];
  readonly total: number;
}

export interface DeviceSessionSummary {
  readonly id: string;
  readonly device: string;
  readonly approxLocation: string;
  readonly lastActiveAt: Date;
  readonly current: boolean;
}

export interface DeviceSessionList {
  readonly sessions: readonly DeviceSessionSummary[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export interface RevokeOtherSessionsResult {
  readonly revokedCount: number;
}

export interface PublicInvitationDetails {
  readonly email: string;
  readonly role: Role;
  readonly inviterName: string | null;
  readonly expiresAt: Date;
}
