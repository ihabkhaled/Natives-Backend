import { NotFoundError } from '@core/errors/not-found.error';

import {
  RBAC_ASSIGNMENT_NOT_FOUND_MESSAGE,
  RBAC_ASSIGNMENT_NOT_FOUND_MESSAGE_KEY,
} from '../model/rbac.constants';

/** Raised when revoking or inspecting an assignment that does not exist or is already revoked. */
export class AssignmentNotFoundError extends NotFoundError {
  constructor() {
    super(
      RBAC_ASSIGNMENT_NOT_FOUND_MESSAGE,
      RBAC_ASSIGNMENT_NOT_FOUND_MESSAGE_KEY,
    );
  }
}
