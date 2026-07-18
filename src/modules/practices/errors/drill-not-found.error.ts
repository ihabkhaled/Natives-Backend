import { NotFoundError } from '@core/errors/not-found.error';

import {
  DRILL_NOT_FOUND_MESSAGE,
  DRILL_NOT_FOUND_MESSAGE_KEY,
} from '../model/agendas.constants';

/** Raised when a catalog drill does not exist within the requested team scope. */
export class DrillNotFoundError extends NotFoundError {
  constructor() {
    super(DRILL_NOT_FOUND_MESSAGE, DRILL_NOT_FOUND_MESSAGE_KEY);
  }
}
