import { NotFoundError } from '@core/errors/not-found.error';

import {
  PROJECTION_NOT_FOUND_MESSAGE,
  PROJECTION_NOT_FOUND_MESSAGE_KEY,
} from '../model/scoring.constants';

export class ScoreProjectionNotFoundError extends NotFoundError {
  constructor() {
    super(PROJECTION_NOT_FOUND_MESSAGE, PROJECTION_NOT_FOUND_MESSAGE_KEY);
  }
}
