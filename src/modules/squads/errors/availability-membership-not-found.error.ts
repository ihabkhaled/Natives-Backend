import { NotFoundError } from '@core/errors/not-found.error';

import {
  AVAILABILITY_MEMBERSHIP_NOT_FOUND_MESSAGE,
  AVAILABILITY_MEMBERSHIP_NOT_FOUND_MESSAGE_KEY,
} from '../model/squads.constants';

/**
 * Raised when the authenticated principal has no active membership in the squad's
 * team and season, so they cannot declare their own availability. Hides existence
 * — the identity always comes from the token, never the body.
 */
export class AvailabilityMembershipNotFoundError extends NotFoundError {
  constructor() {
    super(
      AVAILABILITY_MEMBERSHIP_NOT_FOUND_MESSAGE,
      AVAILABILITY_MEMBERSHIP_NOT_FOUND_MESSAGE_KEY,
    );
  }
}
