import { ConflictError } from '@core/errors/conflict.error';

import {
  IMPORT_NOT_REVERSIBLE_MESSAGE,
  IMPORT_NOT_REVERSIBLE_MESSAGE_KEY,
} from '../model/migration.constants';

export class ImportNotReversibleError extends ConflictError {
  constructor() {
    super(IMPORT_NOT_REVERSIBLE_MESSAGE, IMPORT_NOT_REVERSIBLE_MESSAGE_KEY);
  }
}
