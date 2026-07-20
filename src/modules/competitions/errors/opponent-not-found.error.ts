import { NotFoundError } from '@core/errors/not-found.error';

import {
  OPPONENT_NOT_FOUND_MESSAGE,
  OPPONENT_NOT_FOUND_MESSAGE_KEY,
} from '../model/competitions.constants';

export class OpponentNotFoundError extends NotFoundError {
  constructor() {
    super(OPPONENT_NOT_FOUND_MESSAGE, OPPONENT_NOT_FOUND_MESSAGE_KEY);
  }
}
