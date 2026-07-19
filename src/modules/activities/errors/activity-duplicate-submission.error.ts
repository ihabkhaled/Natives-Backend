import { ConflictError } from '@core/errors/conflict.error';

import {
  ACTIVITY_DUPLICATE_MESSAGE,
  ACTIVITY_DUPLICATE_MESSAGE_KEY,
} from '../model/activities.constants';

export class ActivityDuplicateSubmissionError extends ConflictError {
  constructor() {
    super(ACTIVITY_DUPLICATE_MESSAGE, ACTIVITY_DUPLICATE_MESSAGE_KEY);
  }
}
