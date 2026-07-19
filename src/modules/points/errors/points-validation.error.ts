import { ValidationError } from '@core/errors/validation.error';

import {
  POINTS_VALIDATION_MESSAGE,
  POINTS_VALIDATION_MESSAGE_KEY,
} from '../model/points.constants';

export class PointsValidationError extends ValidationError {
  constructor() {
    super(POINTS_VALIDATION_MESSAGE, POINTS_VALIDATION_MESSAGE_KEY);
  }
}
