import { NotFoundError } from '@core/errors/not-found.error';

import {
  SUBMISSION_NOT_FOUND_MESSAGE,
  SUBMISSION_NOT_FOUND_MESSAGE_KEY,
} from '../model/activities.constants';

export class ActivitySubmissionNotFoundError extends NotFoundError {
  constructor() {
    super(SUBMISSION_NOT_FOUND_MESSAGE, SUBMISSION_NOT_FOUND_MESSAGE_KEY);
  }
}
