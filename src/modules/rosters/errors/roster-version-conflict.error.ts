import { ConflictError } from '@core/errors/conflict.error';

import {
  ROSTER_VERSION_CONFLICT_MESSAGE,
  ROSTER_VERSION_CONFLICT_MESSAGE_KEY,
} from '../model/rosters.constants';

export class RosterVersionConflictError extends ConflictError {
  constructor() {
    super(ROSTER_VERSION_CONFLICT_MESSAGE, ROSTER_VERSION_CONFLICT_MESSAGE_KEY);
  }
}
