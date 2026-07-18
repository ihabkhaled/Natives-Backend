import { NotFoundError } from '@core/errors/not-found.error';

import {
  TEAM_NOT_FOUND_MESSAGE,
  TEAM_NOT_FOUND_MESSAGE_KEY,
} from '../model/practices.constants';

/** Raised when the scoping team is missing or archived (treated as not found). */
export class PracticeTeamNotFoundError extends NotFoundError {
  constructor() {
    super(TEAM_NOT_FOUND_MESSAGE, TEAM_NOT_FOUND_MESSAGE_KEY);
  }
}
