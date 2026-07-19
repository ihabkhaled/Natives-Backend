import { ConflictError } from '@core/errors/conflict.error';

import {
  FEEDBACK_ALREADY_ACKNOWLEDGED_MESSAGE,
  FEEDBACK_ALREADY_ACKNOWLEDGED_MESSAGE_KEY,
} from '../model/development.constants';

export class FeedbackAlreadyAcknowledgedError extends ConflictError {
  constructor() {
    super(
      FEEDBACK_ALREADY_ACKNOWLEDGED_MESSAGE,
      FEEDBACK_ALREADY_ACKNOWLEDGED_MESSAGE_KEY,
    );
  }
}
