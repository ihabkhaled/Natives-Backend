import { NotFoundError } from '@core/errors/not-found.error';

import {
  TRYOUT_EVENT_NOT_FOUND_MESSAGE,
  TRYOUT_EVENT_NOT_FOUND_MESSAGE_KEY,
} from '../model/tryouts.constants';

export class TryoutEventNotFoundError extends NotFoundError {
  constructor() {
    super(TRYOUT_EVENT_NOT_FOUND_MESSAGE, TRYOUT_EVENT_NOT_FOUND_MESSAGE_KEY);
  }
}
