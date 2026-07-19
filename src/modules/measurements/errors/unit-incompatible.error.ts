import { ValidationError } from '@core/errors/validation.error';

import {
  UNIT_INCOMPATIBLE_MESSAGE,
  UNIT_INCOMPATIBLE_MESSAGE_KEY,
} from '../model/measurements.constants';

export class UnitIncompatibleError extends ValidationError {
  constructor() {
    super(UNIT_INCOMPATIBLE_MESSAGE, UNIT_INCOMPATIBLE_MESSAGE_KEY);
  }
}
