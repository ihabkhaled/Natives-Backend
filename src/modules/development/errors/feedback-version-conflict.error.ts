import { ConflictError } from '@core/errors/conflict.error';

import {
  FEEDBACK_VERSION_CONFLICT_MESSAGE,
  FEEDBACK_VERSION_CONFLICT_MESSAGE_KEY,
} from '../model/development.constants';

export class FeedbackVersionConflictError extends ConflictError {
  constructor() {
    super(
      FEEDBACK_VERSION_CONFLICT_MESSAGE,
      FEEDBACK_VERSION_CONFLICT_MESSAGE_KEY,
    );
  }
}
