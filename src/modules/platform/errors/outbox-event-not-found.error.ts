import { NotFoundError } from '@core/errors/not-found.error';

import {
  OUTBOX_EVENT_NOT_FOUND_MESSAGE,
  OUTBOX_EVENT_NOT_FOUND_MESSAGE_KEY,
} from '../model/platform.constants';

/** Raised when a replay targets an outbox event id that does not exist. */
export class OutboxEventNotFoundError extends NotFoundError {
  constructor() {
    super(OUTBOX_EVENT_NOT_FOUND_MESSAGE, OUTBOX_EVENT_NOT_FOUND_MESSAGE_KEY);
  }
}
