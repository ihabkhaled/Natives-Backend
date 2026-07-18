import { ConflictError } from '@core/errors/conflict.error';

import {
  RSVP_DEADLINE_PASSED_MESSAGE,
  RSVP_DEADLINE_PASSED_MESSAGE_KEY,
} from '../model/rsvp.constants';

/**
 * Raised when a member self-RSVPs after the session's RSVP cutoff instant. A coach
 * with the override permission may still record a response past the deadline.
 */
export class RsvpDeadlinePassedError extends ConflictError {
  constructor() {
    super(RSVP_DEADLINE_PASSED_MESSAGE, RSVP_DEADLINE_PASSED_MESSAGE_KEY);
  }
}
