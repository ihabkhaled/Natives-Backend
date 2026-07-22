import { NotFoundError } from '@core/errors/not-found.error';

import {
  STANDING_NOT_FOUND_MESSAGE,
  STANDING_NOT_FOUND_MESSAGE_KEY,
} from '../model/standings.constants';

export class StandingNotFoundError extends NotFoundError {
  constructor() {
    super(STANDING_NOT_FOUND_MESSAGE, STANDING_NOT_FOUND_MESSAGE_KEY);
  }
}
