import { NotFoundError } from '@core/errors/not-found.error';

import {
  ROSTER_NOT_FOUND_MESSAGE,
  ROSTER_NOT_FOUND_MESSAGE_KEY,
} from '../model/rosters.constants';

export class RosterNotFoundError extends NotFoundError {
  constructor() {
    super(ROSTER_NOT_FOUND_MESSAGE, ROSTER_NOT_FOUND_MESSAGE_KEY);
  }
}
