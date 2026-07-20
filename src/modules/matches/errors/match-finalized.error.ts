import { ConflictError } from '@core/errors/conflict.error';

import {
  MATCH_FINALIZED_MESSAGE,
  MATCH_FINALIZED_MESSAGE_KEY,
} from '../model/matches.constants';

export class MatchFinalizedError extends ConflictError {
  constructor() {
    super(MATCH_FINALIZED_MESSAGE, MATCH_FINALIZED_MESSAGE_KEY);
  }
}
