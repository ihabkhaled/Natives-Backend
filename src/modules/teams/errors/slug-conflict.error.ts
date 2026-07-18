import { ConflictError } from '@core/errors/conflict.error';

import {
  SLUG_CONFLICT_MESSAGE,
  SLUG_CONFLICT_MESSAGE_KEY,
} from '../model/teams.constants';

/**
 * Raised when a natural key (team slug, season slug, venue name, or catalog key)
 * already exists within its uniqueness scope.
 */
export class SlugConflictError extends ConflictError {
  constructor() {
    super(SLUG_CONFLICT_MESSAGE, SLUG_CONFLICT_MESSAGE_KEY);
  }
}
