import { ConflictError } from '@core/errors/conflict.error';

import {
  GOAL_VERSION_CONFLICT_MESSAGE,
  GOAL_VERSION_CONFLICT_MESSAGE_KEY,
} from '../model/development.constants';

export class GoalVersionConflictError extends ConflictError {
  constructor() {
    super(GOAL_VERSION_CONFLICT_MESSAGE, GOAL_VERSION_CONFLICT_MESSAGE_KEY);
  }
}
