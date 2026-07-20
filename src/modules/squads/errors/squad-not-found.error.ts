import { NotFoundError } from '@core/errors/not-found.error';

import {
  SQUAD_NOT_FOUND_MESSAGE,
  SQUAD_NOT_FOUND_MESSAGE_KEY,
} from '../model/squads.constants';

export class SquadNotFoundError extends NotFoundError {
  constructor() {
    super(SQUAD_NOT_FOUND_MESSAGE, SQUAD_NOT_FOUND_MESSAGE_KEY);
  }
}
