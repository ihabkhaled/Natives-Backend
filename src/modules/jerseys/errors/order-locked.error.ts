import { ConflictError } from '@core/errors/conflict.error';

import {
  ORDER_LOCKED_MESSAGE,
  ORDER_LOCKED_MESSAGE_KEY,
} from '../model/jerseys.constants';

export class OrderLockedError extends ConflictError {
  constructor() {
    super(ORDER_LOCKED_MESSAGE, ORDER_LOCKED_MESSAGE_KEY);
  }
}
