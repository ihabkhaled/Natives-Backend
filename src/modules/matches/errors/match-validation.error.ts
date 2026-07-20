import { ValidationError } from '@core/errors/validation.error';

import {
  MATCH_VALIDATION_MESSAGE,
  MATCH_VALIDATION_MESSAGE_KEY,
} from '../model/matches.constants';

export class MatchValidationError extends ValidationError {
  constructor() {
    super(MATCH_VALIDATION_MESSAGE, MATCH_VALIDATION_MESSAGE_KEY);
  }
}
