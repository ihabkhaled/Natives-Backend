import { NotFoundError } from '@core/errors/not-found.error';

import {
  GOAL_NOT_FOUND_MESSAGE,
  GOAL_NOT_FOUND_MESSAGE_KEY,
} from '../model/development.constants';

export class DevelopmentGoalNotFoundError extends NotFoundError {
  constructor() {
    super(GOAL_NOT_FOUND_MESSAGE, GOAL_NOT_FOUND_MESSAGE_KEY);
  }
}
