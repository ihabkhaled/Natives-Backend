import { ConflictError } from '@core/errors/conflict.error';

import {
  OPPONENT_CONFLICT_MESSAGE,
  OPPONENT_CONFLICT_MESSAGE_KEY,
} from '../model/competitions.constants';

export class OpponentConflictError extends ConflictError {
  constructor() {
    super(OPPONENT_CONFLICT_MESSAGE, OPPONENT_CONFLICT_MESSAGE_KEY);
  }
}
