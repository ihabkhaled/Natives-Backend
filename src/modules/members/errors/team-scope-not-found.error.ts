import { NotFoundError } from '@core/errors/not-found.error';

import {
  TEAM_SCOPE_NOT_FOUND_MESSAGE,
  TEAM_SCOPE_NOT_FOUND_MESSAGE_KEY,
} from '../model/members.constants';

/**
 * Raised when inviting into a team that does not exist or is archived. Returned
 * as a 404 so a forged team id never confirms or denies the team's existence.
 */
export class TeamScopeNotFoundError extends NotFoundError {
  constructor() {
    super(TEAM_SCOPE_NOT_FOUND_MESSAGE, TEAM_SCOPE_NOT_FOUND_MESSAGE_KEY);
  }
}
