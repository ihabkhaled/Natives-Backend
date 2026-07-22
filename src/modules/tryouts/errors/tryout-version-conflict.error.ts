import { ConflictError } from '@core/errors/conflict.error';

import {
  TRYOUT_VERSION_CONFLICT_MESSAGE,
  TRYOUT_VERSION_CONFLICT_MESSAGE_KEY,
} from '../model/tryouts.constants';

export class TryoutVersionConflictError extends ConflictError {
  constructor() {
    super(TRYOUT_VERSION_CONFLICT_MESSAGE, TRYOUT_VERSION_CONFLICT_MESSAGE_KEY);
  }
}
