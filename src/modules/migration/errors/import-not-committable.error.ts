import { ConflictError } from '@core/errors/conflict.error';

import {
  IMPORT_NOT_COMMITTABLE_MESSAGE,
  IMPORT_NOT_COMMITTABLE_MESSAGE_KEY,
} from '../model/migration.constants';

export class ImportNotCommittableError extends ConflictError {
  constructor() {
    super(IMPORT_NOT_COMMITTABLE_MESSAGE, IMPORT_NOT_COMMITTABLE_MESSAGE_KEY);
  }
}
