import { ConflictError } from '@core/errors/conflict.error';

import {
  JERSEY_CONFLICT_MESSAGE,
  JERSEY_CONFLICT_MESSAGE_KEY,
} from '../model/members.constants';

/** Raised when a jersey number is already reserved by an active member in scope. */
export class JerseyConflictError extends ConflictError {
  constructor() {
    super(JERSEY_CONFLICT_MESSAGE, JERSEY_CONFLICT_MESSAGE_KEY);
  }
}
