import { ConflictError } from '@core/errors/conflict.error';

import {
  STANDINGS_VERSION_CONFLICT_MESSAGE,
  STANDINGS_VERSION_CONFLICT_MESSAGE_KEY,
} from '../model/standings.constants';

export class StandingsVersionConflictError extends ConflictError {
  constructor() {
    super(
      STANDINGS_VERSION_CONFLICT_MESSAGE,
      STANDINGS_VERSION_CONFLICT_MESSAGE_KEY,
    );
  }
}
