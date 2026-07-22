import { NotFoundError } from '@core/errors/not-found.error';

import {
  ACHIEVEMENT_NOT_FOUND_MESSAGE,
  ACHIEVEMENT_NOT_FOUND_MESSAGE_KEY,
} from '../model/standings.constants';

export class AchievementNotFoundError extends NotFoundError {
  constructor() {
    super(ACHIEVEMENT_NOT_FOUND_MESSAGE, ACHIEVEMENT_NOT_FOUND_MESSAGE_KEY);
  }
}
