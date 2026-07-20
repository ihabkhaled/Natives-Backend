import { NotFoundError } from '@core/errors/not-found.error';

import {
  SQUAD_SCOPE_NOT_FOUND_MESSAGE,
  SQUAD_SCOPE_NOT_FOUND_MESSAGE_KEY,
} from '../model/squads.constants';

export class SquadScopeNotFoundError extends NotFoundError {
  constructor() {
    super(SQUAD_SCOPE_NOT_FOUND_MESSAGE, SQUAD_SCOPE_NOT_FOUND_MESSAGE_KEY);
  }
}
