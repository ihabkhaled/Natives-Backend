import { ConflictError } from '@core/errors/conflict.error';

import {
  TRYOUT_DUPLICATE_MESSAGE,
  TRYOUT_DUPLICATE_MESSAGE_KEY,
} from '../model/tryouts.constants';

export class TryoutDuplicateError extends ConflictError {
  constructor() {
    super(TRYOUT_DUPLICATE_MESSAGE, TRYOUT_DUPLICATE_MESSAGE_KEY);
  }
}
