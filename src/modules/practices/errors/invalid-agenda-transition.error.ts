import { ConflictError } from '@core/errors/conflict.error';

import {
  INVALID_AGENDA_TRANSITION_MESSAGE,
  INVALID_AGENDA_TRANSITION_MESSAGE_KEY,
} from '../model/agendas.constants';

/**
 * Raised when a publish or complete action is attempted from a state that does not
 * allow it (e.g. re-publishing a published agenda, or completing a draft).
 */
export class InvalidAgendaTransitionError extends ConflictError {
  constructor() {
    super(
      INVALID_AGENDA_TRANSITION_MESSAGE,
      INVALID_AGENDA_TRANSITION_MESSAGE_KEY,
    );
  }
}
