import { ConflictError } from '@core/errors/conflict.error';

import {
  INVALID_TRANSITION_MESSAGE,
  INVALID_TRANSITION_MESSAGE_KEY,
} from '../model/measurements.constants';

export class MeasurementInvalidTransitionError extends ConflictError {
  constructor() {
    super(INVALID_TRANSITION_MESSAGE, INVALID_TRANSITION_MESSAGE_KEY);
  }
}
