import { ConflictError } from '@core/errors/conflict.error';

import {
  INVITATION_CONFLICT_MESSAGE,
  INVITATION_CONFLICT_MESSAGE_KEY,
} from '../model/identity.constants';

/**
 * Raised when a new invitation collides with an active pending invitation or an
 * existing active account for the same email.
 */
export class InvitationConflictError extends ConflictError {
  constructor() {
    super(INVITATION_CONFLICT_MESSAGE, INVITATION_CONFLICT_MESSAGE_KEY);
  }
}
