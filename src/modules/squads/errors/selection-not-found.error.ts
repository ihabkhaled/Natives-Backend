import { NotFoundError } from '@core/errors/not-found.error';

import {
  SELECTION_NOT_FOUND_MESSAGE,
  SELECTION_NOT_FOUND_MESSAGE_KEY,
} from '../model/squads.constants';

export class SelectionNotFoundError extends NotFoundError {
  constructor() {
    super(SELECTION_NOT_FOUND_MESSAGE, SELECTION_NOT_FOUND_MESSAGE_KEY);
  }
}
