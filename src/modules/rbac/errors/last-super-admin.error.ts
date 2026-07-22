import { ConflictError } from '@core/errors/conflict.error';

import {
  RBAC_LAST_SUPER_ADMIN_MESSAGE,
  RBAC_LAST_SUPER_ADMIN_MESSAGE_KEY,
} from '../model/rbac.constants';

/**
 * Raised when a revoke would remove the last live global super administrator —
 * whether by self-demotion or by another admin. Maps to a 409 with a stable key
 * so the client renders dedicated "cannot remove the last super administrator"
 * copy rather than a generic failure.
 */
export class LastSuperAdminError extends ConflictError {
  constructor() {
    super(RBAC_LAST_SUPER_ADMIN_MESSAGE, RBAC_LAST_SUPER_ADMIN_MESSAGE_KEY);
  }
}
