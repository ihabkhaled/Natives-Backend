import { ConflictError } from '@core/errors/conflict.error';

import {
  RSVP_CLOSED_MESSAGE,
  RSVP_CLOSED_MESSAGE_KEY,
} from '../model/rsvp.constants';

/**
 * Raised when RSVP is attempted on a session whose lifecycle state does not accept
 * responses (draft, cancelled, completed, or archived).
 */
export class RsvpClosedError extends ConflictError {
  constructor() {
    super(RSVP_CLOSED_MESSAGE, RSVP_CLOSED_MESSAGE_KEY);
  }
}
