import { ConflictError } from '@core/errors/conflict.error';

import {
  ROSTER_JERSEY_CONFLICT_MESSAGE,
  ROSTER_JERSEY_CONFLICT_MESSAGE_KEY,
} from '../model/rosters.constants';

export class RosterJerseyConflictError extends ConflictError {
  constructor() {
    super(ROSTER_JERSEY_CONFLICT_MESSAGE, ROSTER_JERSEY_CONFLICT_MESSAGE_KEY);
  }
}
