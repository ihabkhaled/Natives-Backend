import type { AuthUserIdentity } from '@core/auth';

import type {
  Invitation,
  InvitationSummary,
  Principal,
  User,
} from '../model/identity.types';

/**
 * Build the minimal JWT claim set for a user: identifier, email, and the single
 * role wrapped as the roles array the PermissionsGuard consumes. No RBAC catalog
 * resolution happens here — that is a later concern.
 */
export function toAuthUserIdentity(user: User): AuthUserIdentity {
  return {
    userId: user.id,
    email: user.email,
    roles: [user.role],
  };
}

export function toPrincipal(user: User): Principal {
  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
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
