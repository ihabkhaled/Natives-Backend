import { NotFoundError } from '@core/errors/not-found.error';

import {
  MEMBERSHIP_NOT_FOUND_MESSAGE,
  MEMBERSHIP_NOT_FOUND_MESSAGE_KEY,
} from '../model/members.constants';

/** Raised when a membership does not exist within the requested team scope. */
export class MembershipNotFoundError extends NotFoundError {
  constructor() {
    super(MEMBERSHIP_NOT_FOUND_MESSAGE, MEMBERSHIP_NOT_FOUND_MESSAGE_KEY);
  }
}
