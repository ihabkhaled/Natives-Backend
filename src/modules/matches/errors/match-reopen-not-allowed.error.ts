import { ConflictError } from '@core/errors/conflict.error';

import {
  MATCH_REOPEN_NOT_ALLOWED_MESSAGE,
  MATCH_REOPEN_NOT_ALLOWED_MESSAGE_KEY,
} from '../model/matches.constants';

export class MatchReopenNotAllowedError extends ConflictError {
  constructor() {
    super(
      MATCH_REOPEN_NOT_ALLOWED_MESSAGE,
      MATCH_REOPEN_NOT_ALLOWED_MESSAGE_KEY,
    );
  }
}
