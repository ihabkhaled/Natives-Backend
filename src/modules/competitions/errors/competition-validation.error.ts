import { ValidationError } from '@core/errors/validation.error';

import {
  COMPETITION_VALIDATION_MESSAGE,
  COMPETITION_VALIDATION_MESSAGE_KEY,
} from '../model/competitions.constants';

export class CompetitionValidationError extends ValidationError {
  constructor() {
    super(COMPETITION_VALIDATION_MESSAGE, COMPETITION_VALIDATION_MESSAGE_KEY);
  }
}
