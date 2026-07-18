import { NotFoundError } from '@core/errors/not-found.error';

import {
  AGENDA_BLOCK_NOT_FOUND_MESSAGE,
  AGENDA_BLOCK_NOT_FOUND_MESSAGE_KEY,
} from '../model/agendas.constants';

/** Raised when an agenda block does not exist within the requested session scope. */
export class AgendaBlockNotFoundError extends NotFoundError {
  constructor() {
    super(AGENDA_BLOCK_NOT_FOUND_MESSAGE, AGENDA_BLOCK_NOT_FOUND_MESSAGE_KEY);
  }
}
