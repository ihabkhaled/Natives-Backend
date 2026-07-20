import { ConflictError } from '@core/errors/conflict.error';

import {
  ROSTER_CONSTRAINT_MESSAGE,
  ROSTER_CONSTRAINT_MESSAGE_KEY,
} from '../model/rosters.constants';

export class RosterConstraintError extends ConflictError {
  constructor() {
    super(ROSTER_CONSTRAINT_MESSAGE, ROSTER_CONSTRAINT_MESSAGE_KEY);
  }
}
