import type { AuthUserIdentity } from '@core/auth';

import {
  UNKNOWN_APPROXIMATE_LOCATION,
  UNKNOWN_DEVICE_LABEL,
} from '../model/identity.constants';
import { AccountState, UserStatus } from '../model/identity.enums';
import type {
  AuthMembershipPayload,
  AuthUserPayload,
  DeviceSessionList,
  Invitation,
  InvitationSummary,
  IssuedSession,
  LoginResponse,
  Principal,
  RefreshSessionPage,
  SessionListQuery,
  User,
} from '../model/identity.types';

/**
 * Build the minimal JWT claim set for a user: identifier, email, and the single
 * role wrapped as the roles array the PermissionsGuard consumes. No RBAC catalog
 * resolution happens here — that is a later concern.
 */
export function toAuthUserIdentity(
  user: User,
  sessionId?: string,
): AuthUserIdentity {
  const identity: AuthUserIdentity = {
    userId: user.id,
    email: user.email,
    roles: [user.role],
  };
  return sessionId === undefined ? identity : { ...identity, sessionId };
}

export function toPrincipal(user: User): Principal {
  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
  };
}

export function buildAuthUserPayload(
  user: User,
  permissions: readonly string[],
  memberships: readonly AuthMembershipPayload[],
): AuthUserPayload {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName ?? user.email,
    permissions,
    accountState: toAccountState(user.status),
    onboardingComplete: true,
    memberships,
  };
}

/** Map the internal user status to the client-facing account-state contract. */
export function toAccountState(status: UserStatus): AccountState {
  if (status === UserStatus.Active) {
    return AccountState.Active;
  }
  if (status === UserStatus.Invited) {
    return AccountState.Pending;
  }
  return AccountState.Suspended;
}

/**
 * Assemble the login response the frontend contract expects: the token pair plus
 * the enriched principal (display name, resolved permission keys, account state,
 * and the real team/season memberships resolved from the members module).
 */
export function buildLoginResponse(
  session: IssuedSession,
  user: User,
  permissions: readonly string[],
  memberships: readonly AuthMembershipPayload[],
): LoginResponse {
  return {
    tokens: {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    },
    user: buildAuthUserPayload(user, permissions, memberships),
  };
}

export function toInvitationSummary(invitation: Invitation): InvitationSummary {
  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
  };
}

export function toDeviceSessionList(
  page: RefreshSessionPage,
  currentSessionId: string | undefined,
  query: SessionListQuery,
): DeviceSessionList {
  return {
    sessions: page.items.map(session => ({
      id: session.id,
      device: session.deviceLabel ?? UNKNOWN_DEVICE_LABEL,
      approxLocation: UNKNOWN_APPROXIMATE_LOCATION,
      lastActiveAt: session.issuedAt,
      current:
        currentSessionId !== undefined && session.id === currentSessionId,
    })),
    total: page.total,
    limit: query.limit,
    offset: query.offset,
  };
}
