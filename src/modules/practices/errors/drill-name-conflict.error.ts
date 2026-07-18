import { ConflictError } from '@core/errors/conflict.error';

import {
  DRILL_NAME_CONFLICT_MESSAGE,
  DRILL_NAME_CONFLICT_MESSAGE_KEY,
} from '../model/agendas.constants';

/**
 * Raised when creating or renaming a drill would collide with an existing active
 * drill of the same name in the team (the partial unique index rejects it). The
 * clean conflict replaces a raw constraint violation.
 */
export class DrillNameConflictError extends ConflictError {
  constructor() {
    super(DRILL_NAME_CONFLICT_MESSAGE, DRILL_NAME_CONFLICT_MESSAGE_KEY);
  }
}
