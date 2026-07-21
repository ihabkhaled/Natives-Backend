import { NotFoundError } from '@core/errors/not-found.error';

import {
  MATCH_PLAY_NOT_FOUND_MESSAGE,
  MATCH_PLAY_NOT_FOUND_MESSAGE_KEY,
} from '../model/matches.constants';

export class MatchPlayNotFoundError extends NotFoundError {
  constructor() {
    super(MATCH_PLAY_NOT_FOUND_MESSAGE, MATCH_PLAY_NOT_FOUND_MESSAGE_KEY);
  }
}
