import { NotFoundError } from '@core/errors/not-found.error';

import {
  PRODUCT_NOT_FOUND_MESSAGE,
  PRODUCT_NOT_FOUND_MESSAGE_KEY,
} from '../model/jerseys.constants';

export class ProductNotFoundError extends NotFoundError {
  constructor() {
    super(PRODUCT_NOT_FOUND_MESSAGE, PRODUCT_NOT_FOUND_MESSAGE_KEY);
  }
}
