import { ConflictError } from '@core/errors/conflict.error';

import {
  CATALOG_ENTRY_IN_USE_MESSAGE,
  CATALOG_ENTRY_IN_USE_MESSAGE_KEY,
} from '../model/teams.constants';

/** Raised when archiving a catalog entry that is still referenced downstream. */
export class CatalogEntryInUseError extends ConflictError {
  constructor() {
    super(CATALOG_ENTRY_IN_USE_MESSAGE, CATALOG_ENTRY_IN_USE_MESSAGE_KEY);
  }
}
