import { NotFoundError } from '@core/errors/not-found.error';

import {
  MATCH_EVENT_NOT_FOUND_MESSAGE,
  MATCH_EVENT_NOT_FOUND_MESSAGE_KEY,
} from '../model/matches.constants';

export class MatchEventNotFoundError extends NotFoundError {
  constructor() {
    super(MATCH_EVENT_NOT_FOUND_MESSAGE, MATCH_EVENT_NOT_FOUND_MESSAGE_KEY);
  }
}
