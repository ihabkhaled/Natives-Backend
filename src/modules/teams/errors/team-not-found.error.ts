import { NotFoundError } from '@core/errors/not-found.error';

import {
  TEAM_NOT_FOUND_MESSAGE,
  TEAM_NOT_FOUND_MESSAGE_KEY,
} from '../model/teams.constants';

/** Raised when a team does not exist. */
export class TeamNotFoundError extends NotFoundError {
  constructor() {
    super(TEAM_NOT_FOUND_MESSAGE, TEAM_NOT_FOUND_MESSAGE_KEY);
  }
}
