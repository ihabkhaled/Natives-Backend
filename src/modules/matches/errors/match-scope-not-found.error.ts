import { NotFoundError } from '@core/errors/not-found.error';

import {
  MATCH_SCOPE_NOT_FOUND_MESSAGE,
  MATCH_SCOPE_NOT_FOUND_MESSAGE_KEY,
} from '../model/matches.constants';

export class MatchScopeNotFoundError extends NotFoundError {
  constructor() {
    super(MATCH_SCOPE_NOT_FOUND_MESSAGE, MATCH_SCOPE_NOT_FOUND_MESSAGE_KEY);
  }
}
