import { ConflictError } from '@core/errors/conflict.error';

import {
  FEEDBACK_INVALID_TRANSITION_MESSAGE,
  FEEDBACK_INVALID_TRANSITION_MESSAGE_KEY,
} from '../model/development.constants';

export class FeedbackInvalidTransitionError extends ConflictError {
  constructor() {
    super(
      FEEDBACK_INVALID_TRANSITION_MESSAGE,
      FEEDBACK_INVALID_TRANSITION_MESSAGE_KEY,
    );
  }
}
