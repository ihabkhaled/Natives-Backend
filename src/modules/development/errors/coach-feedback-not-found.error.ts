import { NotFoundError } from '@core/errors/not-found.error';

import {
  FEEDBACK_NOT_FOUND_MESSAGE,
  FEEDBACK_NOT_FOUND_MESSAGE_KEY,
} from '../model/development.constants';

export class CoachFeedbackNotFoundError extends NotFoundError {
  constructor() {
    super(FEEDBACK_NOT_FOUND_MESSAGE, FEEDBACK_NOT_FOUND_MESSAGE_KEY);
  }
}
