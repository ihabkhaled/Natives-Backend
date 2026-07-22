import { NotFoundError } from '@core/errors/not-found.error';

import {
  JERSEY_SCOPE_NOT_FOUND_MESSAGE,
  JERSEY_SCOPE_NOT_FOUND_MESSAGE_KEY,
} from '../model/jerseys.constants';

export class JerseyScopeNotFoundError extends NotFoundError {
  constructor() {
    super(JERSEY_SCOPE_NOT_FOUND_MESSAGE, JERSEY_SCOPE_NOT_FOUND_MESSAGE_KEY);
  }
}
