import { NotFoundError } from '@core/errors/not-found.error';

import {
  ROSTER_ENTRY_NOT_FOUND_MESSAGE,
  ROSTER_ENTRY_NOT_FOUND_MESSAGE_KEY,
} from '../model/rosters.constants';

export class RosterEntryNotFoundError extends NotFoundError {
  constructor() {
    super(ROSTER_ENTRY_NOT_FOUND_MESSAGE, ROSTER_ENTRY_NOT_FOUND_MESSAGE_KEY);
  }
}
