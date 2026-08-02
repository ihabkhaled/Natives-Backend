import { NotFoundError } from '@core/errors/not-found.error';

import {
  STAFF_MEMBERSHIP_NOT_FOUND_MESSAGE,
  STAFF_MEMBERSHIP_NOT_FOUND_MESSAGE_KEY,
} from '../model/teams.constants';

/** Raised when the referenced membership does not exist within the team. */
export class StaffMembershipNotFoundError extends NotFoundError {
  constructor() {
    super(
      STAFF_MEMBERSHIP_NOT_FOUND_MESSAGE,
      STAFF_MEMBERSHIP_NOT_FOUND_MESSAGE_KEY,
    );
  }
}
