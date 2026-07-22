import { ConflictError } from '@core/errors/conflict.error';

import {
  ORDER_INVALID_TRANSITION_MESSAGE,
  ORDER_INVALID_TRANSITION_MESSAGE_KEY,
} from '../model/jerseys.constants';

export class OrderInvalidTransitionError extends ConflictError {
  constructor() {
    super(
      ORDER_INVALID_TRANSITION_MESSAGE,
      ORDER_INVALID_TRANSITION_MESSAGE_KEY,
    );
  }
}
