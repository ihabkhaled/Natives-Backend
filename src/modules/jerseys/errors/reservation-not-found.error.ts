import { NotFoundError } from '@core/errors/not-found.error';

import {
  RESERVATION_NOT_FOUND_MESSAGE,
  RESERVATION_NOT_FOUND_MESSAGE_KEY,
} from '../model/jerseys.constants';

export class ReservationNotFoundError extends NotFoundError {
  constructor() {
    super(RESERVATION_NOT_FOUND_MESSAGE, RESERVATION_NOT_FOUND_MESSAGE_KEY);
  }
}
