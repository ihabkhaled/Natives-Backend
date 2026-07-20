import { NotFoundError } from '@core/errors/not-found.error';

import {
  ROSTER_AVAILABILITY_MEMBERSHIP_NOT_FOUND_MESSAGE,
  ROSTER_AVAILABILITY_MEMBERSHIP_NOT_FOUND_MESSAGE_KEY,
} from '../model/rosters.constants';

export class RosterAvailabilityMembershipNotFoundError extends NotFoundError {
  constructor() {
    super(
      ROSTER_AVAILABILITY_MEMBERSHIP_NOT_FOUND_MESSAGE,
      ROSTER_AVAILABILITY_MEMBERSHIP_NOT_FOUND_MESSAGE_KEY,
    );
  }
}
