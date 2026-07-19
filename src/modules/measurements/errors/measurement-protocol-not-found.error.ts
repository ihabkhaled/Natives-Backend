import { NotFoundError } from '@core/errors/not-found.error';

import {
  PROTOCOL_NOT_FOUND_MESSAGE,
  PROTOCOL_NOT_FOUND_MESSAGE_KEY,
} from '../model/measurements.constants';

export class MeasurementProtocolNotFoundError extends NotFoundError {
  constructor() {
    super(PROTOCOL_NOT_FOUND_MESSAGE, PROTOCOL_NOT_FOUND_MESSAGE_KEY);
  }
}
