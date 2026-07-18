import { ValidationError } from '@core/errors/validation.error';

import {
  INVITATION_INVALID_MESSAGE,
  INVITATION_INVALID_MESSAGE_KEY,
} from '../model/identity.constants';

/**
 * Raised when an invitation token is unknown, expired, already accepted, or
 * revoked. Generic by design — the token is the secret, so no account detail is
 * disclosed.
 */
export class InvitationInvalidError extends ValidationError {
  constructor() {
    super(INVITATION_INVALID_MESSAGE, INVITATION_INVALID_MESSAGE_KEY);
  }
}
