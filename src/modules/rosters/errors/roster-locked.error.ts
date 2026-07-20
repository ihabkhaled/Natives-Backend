import { ConflictError } from '@core/errors/conflict.error';

import {
  ROSTER_LOCKED_MESSAGE,
  ROSTER_LOCKED_MESSAGE_KEY,
} from '../model/rosters.constants';

export class RosterLockedError extends ConflictError {
  constructor() {
    super(ROSTER_LOCKED_MESSAGE, ROSTER_LOCKED_MESSAGE_KEY);
  }
}
