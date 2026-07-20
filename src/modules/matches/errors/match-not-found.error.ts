import { NotFoundError } from '@core/errors/not-found.error';

import {
  MATCH_NOT_FOUND_MESSAGE,
  MATCH_NOT_FOUND_MESSAGE_KEY,
} from '../model/matches.constants';

export class MatchNotFoundError extends NotFoundError {
  constructor() {
    super(MATCH_NOT_FOUND_MESSAGE, MATCH_NOT_FOUND_MESSAGE_KEY);
  }
}
