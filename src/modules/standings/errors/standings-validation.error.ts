import { ValidationError } from '@core/errors/validation.error';

import {
  STANDINGS_VALIDATION_MESSAGE,
  STANDINGS_VALIDATION_MESSAGE_KEY,
} from '../model/standings.constants';

export class StandingsValidationError extends ValidationError {
  constructor() {
    super(STANDINGS_VALIDATION_MESSAGE, STANDINGS_VALIDATION_MESSAGE_KEY);
  }
}
