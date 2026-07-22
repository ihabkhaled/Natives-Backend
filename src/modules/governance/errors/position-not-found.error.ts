import { NotFoundError } from '@core/errors/not-found.error';

import {
  POSITION_NOT_FOUND_MESSAGE,
  POSITION_NOT_FOUND_MESSAGE_KEY,
} from '../model/governance.constants';

export class PositionNotFoundError extends NotFoundError {
  constructor() {
    super(POSITION_NOT_FOUND_MESSAGE, POSITION_NOT_FOUND_MESSAGE_KEY);
  }
}
