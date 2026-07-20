import { NotFoundError } from '@core/errors/not-found.error';

import {
  ROSTER_SCOPE_NOT_FOUND_MESSAGE,
  ROSTER_SCOPE_NOT_FOUND_MESSAGE_KEY,
} from '../model/rosters.constants';

export class RosterScopeNotFoundError extends NotFoundError {
  constructor() {
    super(ROSTER_SCOPE_NOT_FOUND_MESSAGE, ROSTER_SCOPE_NOT_FOUND_MESSAGE_KEY);
  }
}
