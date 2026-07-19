import { NotFoundError } from '@core/errors/not-found.error';

import {
  ACTIVITY_TYPE_NOT_FOUND_MESSAGE,
  ACTIVITY_TYPE_NOT_FOUND_MESSAGE_KEY,
} from '../model/activities.constants';

export class ActivityTypeNotFoundError extends NotFoundError {
  constructor() {
    super(ACTIVITY_TYPE_NOT_FOUND_MESSAGE, ACTIVITY_TYPE_NOT_FOUND_MESSAGE_KEY);
  }
}
