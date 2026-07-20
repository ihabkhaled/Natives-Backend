import { ValidationError } from '@core/errors/validation.error';

import {
  SQUAD_VALIDATION_MESSAGE,
  SQUAD_VALIDATION_MESSAGE_KEY,
} from '../model/squads.constants';

export class SquadValidationError extends ValidationError {
  constructor() {
    super(SQUAD_VALIDATION_MESSAGE, SQUAD_VALIDATION_MESSAGE_KEY);
  }
}
