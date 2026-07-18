import { NotFoundError } from '@core/errors/not-found.error';

import {
  RSVP_MEMBERSHIP_NOT_FOUND_MESSAGE,
  RSVP_MEMBERSHIP_NOT_FOUND_MESSAGE_KEY,
} from '../model/rsvp.constants';

/**
 * Raised when a coach override targets a membership that does not exist as an
 * active member of the team. A membership in another team resolves to not-found,
 * hiding cross-team existence.
 */
export class RsvpMembershipNotFoundError extends NotFoundError {
  constructor() {
    super(
      RSVP_MEMBERSHIP_NOT_FOUND_MESSAGE,
      RSVP_MEMBERSHIP_NOT_FOUND_MESSAGE_KEY,
    );
  }
}
