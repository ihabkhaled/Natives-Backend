import { ConflictError } from '@core/errors/conflict.error';

import {
  ALIAS_CONFLICT_MESSAGE,
  ALIAS_CONFLICT_MESSAGE_KEY,
} from '../model/members.constants';

/** Raised when a normalized alias already belongs to an active member in the team. */
export class AliasConflictError extends ConflictError {
  constructor() {
    super(ALIAS_CONFLICT_MESSAGE, ALIAS_CONFLICT_MESSAGE_KEY);
  }
}
