import { NotFoundError } from '@core/errors/not-found.error';

import {
  MEASUREMENT_SCOPE_NOT_FOUND_MESSAGE,
  MEASUREMENT_SCOPE_NOT_FOUND_MESSAGE_KEY,
} from '../model/measurements.constants';

export class MeasurementScopeNotFoundError extends NotFoundError {
  constructor() {
    super(
      MEASUREMENT_SCOPE_NOT_FOUND_MESSAGE,
      MEASUREMENT_SCOPE_NOT_FOUND_MESSAGE_KEY,
    );
  }
}
