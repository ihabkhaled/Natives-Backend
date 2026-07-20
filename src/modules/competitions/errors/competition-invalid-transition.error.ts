import { ConflictError } from '@core/errors/conflict.error';

import {
  COMPETITION_INVALID_TRANSITION_MESSAGE,
  COMPETITION_INVALID_TRANSITION_MESSAGE_KEY,
} from '../model/competitions.constants';

export class CompetitionInvalidTransitionError extends ConflictError {
  constructor() {
    super(
      COMPETITION_INVALID_TRANSITION_MESSAGE,
      COMPETITION_INVALID_TRANSITION_MESSAGE_KEY,
    );
  }
}
