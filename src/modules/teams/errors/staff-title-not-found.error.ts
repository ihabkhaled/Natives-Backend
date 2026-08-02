import { NotFoundError } from '@core/errors/not-found.error';

import {
  STAFF_TITLE_NOT_FOUND_MESSAGE,
  STAFF_TITLE_NOT_FOUND_MESSAGE_KEY,
} from '../model/teams.constants';

/**
 * Raised when the referenced catalog entry does not exist, belongs to a
 * different catalog, or is archived — not a live, assignable staff title.
 */
export class StaffTitleNotFoundError extends NotFoundError {
  constructor() {
    super(STAFF_TITLE_NOT_FOUND_MESSAGE, STAFF_TITLE_NOT_FOUND_MESSAGE_KEY);
  }
}
