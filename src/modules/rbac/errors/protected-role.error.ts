import { ForbiddenError } from '@core/errors/forbidden.error';

import {
  RBAC_PROTECTED_ROLE_MESSAGE,
  RBAC_PROTECTED_ROLE_MESSAGE_KEY,
} from '../model/rbac.constants';

/**
 * Raised when a team-scoped flow (invitation, role replace, scoped assignment)
 * targets a protected role — platform-scoped or marked unassignable in the
 * catalog. Maps to a 403 with a stable key so clients can render dedicated copy
 * distinct from a ceiling denial.
 */
export class ProtectedRoleError extends ForbiddenError {
  constructor() {
    super(RBAC_PROTECTED_ROLE_MESSAGE, RBAC_PROTECTED_ROLE_MESSAGE_KEY);
  }
}
