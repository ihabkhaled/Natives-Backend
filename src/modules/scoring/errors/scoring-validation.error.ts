import { ValidationError } from '@core/errors/validation.error';

import {
  SCORING_VALIDATION_MESSAGE,
  SCORING_VALIDATION_MESSAGE_KEY,
} from '../model/scoring.constants';

export class ScoringValidationError extends ValidationError {
  constructor() {
    super(SCORING_VALIDATION_MESSAGE, SCORING_VALIDATION_MESSAGE_KEY);
  }
}
