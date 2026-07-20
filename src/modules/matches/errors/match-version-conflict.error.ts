import { ConflictError } from '@core/errors/conflict.error';

import {
  MATCH_VERSION_CONFLICT_MESSAGE,
  MATCH_VERSION_CONFLICT_MESSAGE_KEY,
} from '../model/matches.constants';

export class MatchVersionConflictError extends ConflictError {
  constructor() {
    super(MATCH_VERSION_CONFLICT_MESSAGE, MATCH_VERSION_CONFLICT_MESSAGE_KEY);
  }
}
