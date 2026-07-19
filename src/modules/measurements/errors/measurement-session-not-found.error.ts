import { NotFoundError } from '@core/errors/not-found.error';

import {
  SESSION_NOT_FOUND_MESSAGE,
  SESSION_NOT_FOUND_MESSAGE_KEY,
} from '../model/measurements.constants';

export class MeasurementSessionNotFoundError extends NotFoundError {
  constructor() {
    super(SESSION_NOT_FOUND_MESSAGE, SESSION_NOT_FOUND_MESSAGE_KEY);
  }
}
