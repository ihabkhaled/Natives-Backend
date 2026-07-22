import { ConflictError } from '@core/errors/conflict.error';

import {
  JERSEY_VERSION_CONFLICT_MESSAGE,
  JERSEY_VERSION_CONFLICT_MESSAGE_KEY,
} from '../model/jerseys.constants';

export class JerseyVersionConflictError extends ConflictError {
  constructor() {
    super(JERSEY_VERSION_CONFLICT_MESSAGE, JERSEY_VERSION_CONFLICT_MESSAGE_KEY);
  }
}
