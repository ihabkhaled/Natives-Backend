import { ConflictError } from '@core/errors/conflict.error';

import {
  MATCH_TIMEOUTS_EXHAUSTED_MESSAGE,
  MATCH_TIMEOUTS_EXHAUSTED_MESSAGE_KEY,
} from '../model/matches.constants';

export class MatchTimeoutsExhaustedError extends ConflictError {
  constructor() {
    super(
      MATCH_TIMEOUTS_EXHAUSTED_MESSAGE,
      MATCH_TIMEOUTS_EXHAUSTED_MESSAGE_KEY,
    );
  }
}
