export enum UserStatus {
  Invited = 'invited',
  /**
   * A self-signed-up account awaiting admin approval. Inert: it holds no role or
   * membership and cannot authenticate (see user-status.policy) until an admin
   * approves it, which flips it to Active.
   */
  Pending = 'pending',
  Active = 'active',
  Inactive = 'inactive',
  Suspended = 'suspended',
  /** A self-signup an admin declined. Terminal and inert — never authenticates. */
  Rejected = 'rejected',
  Left = 'left',
}

export const USER_STATUS_VALUES: readonly UserStatus[] =
  Object.values(UserStatus);

/**
 * Stable client-facing account states. Internal lifecycle statuses deliberately
 * collapse into this smaller compatibility contract at the identity boundary.
 */
export enum AccountState {
  Active = 'active',
  Pending = 'pending',
  Suspended = 'suspended',
}

export const ACCOUNT_STATE_VALUES: readonly AccountState[] =
  Object.values(AccountState);

export enum InvitationStatus {
  Pending = 'pending',
  Accepted = 'accepted',
  Revoked = 'revoked',
  Expired = 'expired',
}

export const INVITATION_STATUS_VALUES: readonly InvitationStatus[] =
  Object.values(InvitationStatus);

export enum SecurityEventType {
  LoginSucceeded = 'login.succeeded',
  LoginFailed = 'login.failed',
  AccountLocked = 'account.locked',
  TokenRefreshed = 'session.refreshed',
  RefreshReuseDetected = 'session.reuseDetected',
  SessionRevoked = 'session.revoked',
  OtherSessionsRevoked = 'session.othersRevoked',
  AllSessionsRevoked = 'session.allRevoked',
  InvitationCreated = 'invitation.created',
  InvitationResent = 'invitation.resent',
  InvitationRevoked = 'invitation.revoked',
  InvitationAccepted = 'invitation.accepted',
  SignupRequested = 'signup.requested',
  SignupApproved = 'signup.approved',
  SignupRejected = 'signup.rejected',
  PasswordResetRequested = 'recovery.requested',
  PasswordResetCompleted = 'recovery.completed',
}

export const SECURITY_EVENT_TYPE_VALUES: readonly SecurityEventType[] =
  Object.values(SecurityEventType);
