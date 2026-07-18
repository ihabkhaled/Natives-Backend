import { NotFoundError } from '@core/errors/not-found.error';

import {
  RBAC_ROLE_NOT_FOUND_MESSAGE,
  RBAC_ROLE_NOT_FOUND_MESSAGE_KEY,
} from '../model/rbac.constants';

/** Raised when an assignment references a role key that does not exist. */
export class RoleNotFoundError extends NotFoundError {
  constructor() {
    super(RBAC_ROLE_NOT_FOUND_MESSAGE, RBAC_ROLE_NOT_FOUND_MESSAGE_KEY);
  }
}
