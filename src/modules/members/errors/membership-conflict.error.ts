import { ConflictError } from '@core/errors/conflict.error';

import {
  MEMBERSHIP_CONFLICT_MESSAGE,
  MEMBERSHIP_CONFLICT_MESSAGE_KEY,
} from '../model/members.constants';

/** Raised when a person already has a membership in the same team and season. */
export class MembershipConflictError extends ConflictError {
  constructor() {
    super(MEMBERSHIP_CONFLICT_MESSAGE, MEMBERSHIP_CONFLICT_MESSAGE_KEY);
  }
}
