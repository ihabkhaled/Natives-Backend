import { NotFoundError } from '@core/errors/not-found.error';

import {
  INVITATION_NOT_FOUND_MESSAGE,
  INVITATION_NOT_FOUND_MESSAGE_KEY,
} from '../model/identity.constants';

/**
 * Raised when a privileged actor targets an invitation id that does not exist.
 */
export class InvitationNotFoundError extends NotFoundError {
  constructor() {
    super(INVITATION_NOT_FOUND_MESSAGE, INVITATION_NOT_FOUND_MESSAGE_KEY);
  }
}
