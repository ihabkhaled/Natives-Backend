import { ConflictError } from '@core/errors/conflict.error';

import {
  MATCH_OPERATION_CONFLICT_MESSAGE,
  MATCH_OPERATION_CONFLICT_MESSAGE_KEY,
} from '../model/matches.constants';

export class MatchOperationConflictError extends ConflictError {
  constructor() {
    super(
      MATCH_OPERATION_CONFLICT_MESSAGE,
      MATCH_OPERATION_CONFLICT_MESSAGE_KEY,
    );
  }
}
