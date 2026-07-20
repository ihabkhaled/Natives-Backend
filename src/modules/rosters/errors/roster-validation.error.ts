import { ValidationError } from '@core/errors/validation.error';

import {
  ROSTER_VALIDATION_MESSAGE,
  ROSTER_VALIDATION_MESSAGE_KEY,
} from '../model/rosters.constants';

export class RosterValidationError extends ValidationError {
  constructor() {
    super(ROSTER_VALIDATION_MESSAGE, ROSTER_VALIDATION_MESSAGE_KEY);
  }
}
