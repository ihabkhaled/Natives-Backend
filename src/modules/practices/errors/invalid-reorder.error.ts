import { ValidationError } from '@core/errors/validation.error';

import {
  INVALID_REORDER_MESSAGE,
  INVALID_REORDER_MESSAGE_KEY,
} from '../model/agendas.constants';

/**
 * Raised when a block reorder request is not a permutation of exactly the agenda's
 * current blocks (an unknown, missing, or duplicated id). Rejecting it keeps the
 * ordering total and prevents dropping or smuggling blocks via a reorder.
 */
export class InvalidReorderError extends ValidationError {
  constructor() {
    super(INVALID_REORDER_MESSAGE, INVALID_REORDER_MESSAGE_KEY);
  }
}
