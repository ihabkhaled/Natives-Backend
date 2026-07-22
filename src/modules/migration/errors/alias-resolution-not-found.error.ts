import { NotFoundError } from '@core/errors/not-found.error';

import {
  ALIAS_RESOLUTION_NOT_FOUND_MESSAGE,
  ALIAS_RESOLUTION_NOT_FOUND_MESSAGE_KEY,
} from '../model/migration.constants';

export class AliasResolutionNotFoundError extends NotFoundError {
  constructor() {
    super(
      ALIAS_RESOLUTION_NOT_FOUND_MESSAGE,
      ALIAS_RESOLUTION_NOT_FOUND_MESSAGE_KEY,
    );
  }
}
