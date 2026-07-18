import { NotFoundError } from '@core/errors/not-found.error';

import {
  CATALOG_ENTRY_NOT_FOUND_MESSAGE,
  CATALOG_ENTRY_NOT_FOUND_MESSAGE_KEY,
} from '../model/teams.constants';

/** Raised when a catalog entry does not exist within the requested team scope. */
export class CatalogEntryNotFoundError extends NotFoundError {
  constructor() {
    super(CATALOG_ENTRY_NOT_FOUND_MESSAGE, CATALOG_ENTRY_NOT_FOUND_MESSAGE_KEY);
  }
}
