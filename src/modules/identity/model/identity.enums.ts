export enum UserStatus {
  Invited = 'invited',
  Active = 'active',
  Inactive = 'inactive',
  Suspended = 'suspended',
  Left = 'left',
}

export const USER_STATUS_VALUES: readonly UserStatus[] =
  Object.values(UserStatus);

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
  AllSessionsRevoked = 'session.allRevoked',
  InvitationCreated = 'invitation.created',
  InvitationResent = 'invitation.resent',
  InvitationRevoked = 'invitation.revoked',
  InvitationAccepted = 'invitation.accepted',
  PasswordResetRequested = 'recovery.requested',
  PasswordResetCompleted = 'recovery.completed',
}

export const SECURITY_EVENT_TYPE_VALUES: readonly SecurityEventType[] =
  Object.values(SecurityEventType);
