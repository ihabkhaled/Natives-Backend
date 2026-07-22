import { ConflictError } from '@core/errors/conflict.error';

import {
  RBAC_USER_NOT_ELIGIBLE_MESSAGE,
  RBAC_USER_NOT_ELIGIBLE_MESSAGE_KEY,
} from '../model/rbac.constants';

/**
 * Raised when a super-admin promotion targets a user that does not exist or is
 * not active. A 409 (state conflict), deliberately not disclosing which of the
 * two conditions failed.
 */
export class UserNotEligibleError extends ConflictError {
  constructor() {
    super(RBAC_USER_NOT_ELIGIBLE_MESSAGE, RBAC_USER_NOT_ELIGIBLE_MESSAGE_KEY);
  }
}
