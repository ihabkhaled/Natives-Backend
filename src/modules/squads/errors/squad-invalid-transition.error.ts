import { ConflictError } from '@core/errors/conflict.error';

import {
  SQUAD_INVALID_TRANSITION_MESSAGE,
  SQUAD_INVALID_TRANSITION_MESSAGE_KEY,
} from '../model/squads.constants';

export class SquadInvalidTransitionError extends ConflictError {
  constructor() {
    super(
      SQUAD_INVALID_TRANSITION_MESSAGE,
      SQUAD_INVALID_TRANSITION_MESSAGE_KEY,
    );
  }
}
