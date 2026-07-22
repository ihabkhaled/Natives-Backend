import { ConflictError } from '@core/errors/conflict.error';

import {
  ACHIEVEMENT_INVALID_TRANSITION_MESSAGE,
  ACHIEVEMENT_INVALID_TRANSITION_MESSAGE_KEY,
} from '../model/standings.constants';

export class AchievementInvalidTransitionError extends ConflictError {
  constructor() {
    super(
      ACHIEVEMENT_INVALID_TRANSITION_MESSAGE,
      ACHIEVEMENT_INVALID_TRANSITION_MESSAGE_KEY,
    );
  }
}
