import { ConflictError } from '@core/errors/conflict.error';

import {
  INSUFFICIENT_STOCK_MESSAGE,
  INSUFFICIENT_STOCK_MESSAGE_KEY,
} from '../model/jerseys.constants';

export class InsufficientStockError extends ConflictError {
  constructor() {
    super(INSUFFICIENT_STOCK_MESSAGE, INSUFFICIENT_STOCK_MESSAGE_KEY);
  }
}
