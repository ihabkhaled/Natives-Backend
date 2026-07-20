import { ConflictError } from '@core/errors/conflict.error';

import {
  SQUAD_VERSION_CONFLICT_MESSAGE,
  SQUAD_VERSION_CONFLICT_MESSAGE_KEY,
} from '../model/squads.constants';

export class SquadVersionConflictError extends ConflictError {
  constructor() {
    super(SQUAD_VERSION_CONFLICT_MESSAGE, SQUAD_VERSION_CONFLICT_MESSAGE_KEY);
  }
}
