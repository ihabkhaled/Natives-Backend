import { NotFoundError } from '@core/errors/not-found.error';

import {
  AGENDA_NOT_FOUND_MESSAGE,
  AGENDA_NOT_FOUND_MESSAGE_KEY,
} from '../model/agendas.constants';

/** Raised when a session has no agenda yet, or the session is out of team scope. */
export class AgendaNotFoundError extends NotFoundError {
  constructor() {
    super(AGENDA_NOT_FOUND_MESSAGE, AGENDA_NOT_FOUND_MESSAGE_KEY);
  }
}
