import { ConflictError } from '@core/errors/conflict.error';

import {
  AGENDA_LOCKED_MESSAGE,
  AGENDA_LOCKED_MESSAGE_KEY,
} from '../model/agendas.constants';

/**
 * Raised when a structural edit (add/update/remove/reorder a block, station, or
 * group) targets an agenda that is already published. After publish the plan is
 * locked; execution/completion is recorded instead of silently mutating structure.
 */
export class AgendaLockedError extends ConflictError {
  constructor() {
    super(AGENDA_LOCKED_MESSAGE, AGENDA_LOCKED_MESSAGE_KEY);
  }
}
