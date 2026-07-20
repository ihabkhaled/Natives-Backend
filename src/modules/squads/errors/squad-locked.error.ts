import { ConflictError } from '@core/errors/conflict.error';

import {
  SQUAD_LOCKED_MESSAGE,
  SQUAD_LOCKED_MESSAGE_KEY,
} from '../model/squads.constants';

export class SquadLockedError extends ConflictError {
  constructor() {
    super(SQUAD_LOCKED_MESSAGE, SQUAD_LOCKED_MESSAGE_KEY);
  }
}
