import { ConflictError } from '@core/errors/conflict.error';

import {
  GOAL_INVALID_TRANSITION_MESSAGE,
  GOAL_INVALID_TRANSITION_MESSAGE_KEY,
} from '../model/development.constants';

export class GoalInvalidTransitionError extends ConflictError {
  constructor() {
    super(GOAL_INVALID_TRANSITION_MESSAGE, GOAL_INVALID_TRANSITION_MESSAGE_KEY);
  }
}
