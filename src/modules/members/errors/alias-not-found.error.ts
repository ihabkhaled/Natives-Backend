import { NotFoundError } from '@core/errors/not-found.error';

import {
  ALIAS_NOT_FOUND_MESSAGE,
  ALIAS_NOT_FOUND_MESSAGE_KEY,
} from '../model/members.constants';

/** Raised when an alias does not exist for the requested membership. */
export class AliasNotFoundError extends NotFoundError {
  constructor() {
    super(ALIAS_NOT_FOUND_MESSAGE, ALIAS_NOT_FOUND_MESSAGE_KEY);
  }
}
