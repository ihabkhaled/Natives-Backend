import { ConflictError } from '@core/errors/conflict.error';

import {
  ACTIVITY_INVALID_TRANSITION_MESSAGE,
  ACTIVITY_INVALID_TRANSITION_MESSAGE_KEY,
} from '../model/activities.constants';

export class ActivityInvalidTransitionError extends ConflictError {
  constructor() {
    super(
      ACTIVITY_INVALID_TRANSITION_MESSAGE,
      ACTIVITY_INVALID_TRANSITION_MESSAGE_KEY,
    );
  }
}
