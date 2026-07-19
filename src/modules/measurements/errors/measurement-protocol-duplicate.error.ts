import { ConflictError } from '@core/errors/conflict.error';

import {
  PROTOCOL_DUPLICATE_MESSAGE,
  PROTOCOL_DUPLICATE_MESSAGE_KEY,
} from '../model/measurements.constants';

export class MeasurementProtocolDuplicateError extends ConflictError {
  constructor() {
    super(PROTOCOL_DUPLICATE_MESSAGE, PROTOCOL_DUPLICATE_MESSAGE_KEY);
  }
}
