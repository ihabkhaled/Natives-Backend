import { ConflictError } from '@core/errors/conflict.error';

import {
  VERSION_CONFLICT_MESSAGE,
  VERSION_CONFLICT_MESSAGE_KEY,
} from '../model/measurements.constants';

export class MeasurementVersionConflictError extends ConflictError {
  constructor() {
    super(VERSION_CONFLICT_MESSAGE, VERSION_CONFLICT_MESSAGE_KEY);
  }
}
