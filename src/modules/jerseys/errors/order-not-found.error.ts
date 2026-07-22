import { NotFoundError } from '@core/errors/not-found.error';

import {
  ORDER_NOT_FOUND_MESSAGE,
  ORDER_NOT_FOUND_MESSAGE_KEY,
} from '../model/jerseys.constants';

export class OrderNotFoundError extends NotFoundError {
  constructor() {
    super(ORDER_NOT_FOUND_MESSAGE, ORDER_NOT_FOUND_MESSAGE_KEY);
  }
}
