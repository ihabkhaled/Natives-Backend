import { NotFoundError } from '@core/errors/not-found.error';

import {
  STAFF_ASSIGNMENT_NOT_FOUND_MESSAGE,
  STAFF_ASSIGNMENT_NOT_FOUND_MESSAGE_KEY,
} from '../model/teams.constants';

/** Raised when the referenced staff assignment does not exist or is already removed. */
export class StaffAssignmentNotFoundError extends NotFoundError {
  constructor() {
    super(
      STAFF_ASSIGNMENT_NOT_FOUND_MESSAGE,
      STAFF_ASSIGNMENT_NOT_FOUND_MESSAGE_KEY,
    );
  }
}
