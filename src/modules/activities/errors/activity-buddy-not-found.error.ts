import { NotFoundError } from '@core/errors/not-found.error';

import {
  BUDDY_NOT_FOUND_MESSAGE,
  BUDDY_NOT_FOUND_MESSAGE_KEY,
} from '../model/activities.constants';

export class ActivityBuddyNotFoundError extends NotFoundError {
  constructor() {
    super(BUDDY_NOT_FOUND_MESSAGE, BUDDY_NOT_FOUND_MESSAGE_KEY);
  }
}
