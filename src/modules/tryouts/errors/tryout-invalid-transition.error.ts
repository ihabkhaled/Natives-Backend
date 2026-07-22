import { ConflictError } from '@core/errors/conflict.error';

import {
  TRYOUT_INVALID_TRANSITION_MESSAGE,
  TRYOUT_INVALID_TRANSITION_MESSAGE_KEY,
} from '../model/tryouts.constants';

export class TryoutInvalidTransitionError extends ConflictError {
  constructor() {
    super(
      TRYOUT_INVALID_TRANSITION_MESSAGE,
      TRYOUT_INVALID_TRANSITION_MESSAGE_KEY,
    );
  }
}
