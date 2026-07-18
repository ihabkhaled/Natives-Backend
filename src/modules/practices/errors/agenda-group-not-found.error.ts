import { NotFoundError } from '@core/errors/not-found.error';

import {
  AGENDA_GROUP_NOT_FOUND_MESSAGE,
  AGENDA_GROUP_NOT_FOUND_MESSAGE_KEY,
} from '../model/agendas.constants';

/** Raised when an agenda group does not exist within the requested session scope. */
export class AgendaGroupNotFoundError extends NotFoundError {
  constructor() {
    super(AGENDA_GROUP_NOT_FOUND_MESSAGE, AGENDA_GROUP_NOT_FOUND_MESSAGE_KEY);
  }
}
