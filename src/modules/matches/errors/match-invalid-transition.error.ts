import { ConflictError } from '@core/errors/conflict.error';

import {
  MATCH_INVALID_TRANSITION_MESSAGE,
  MATCH_INVALID_TRANSITION_MESSAGE_KEY,
} from '../model/matches.constants';

export class MatchInvalidTransitionError extends ConflictError {
  constructor() {
    super(
      MATCH_INVALID_TRANSITION_MESSAGE,
      MATCH_INVALID_TRANSITION_MESSAGE_KEY,
    );
  }
}
