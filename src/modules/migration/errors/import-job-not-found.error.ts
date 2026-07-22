import { NotFoundError } from '@core/errors/not-found.error';

import {
  IMPORT_JOB_NOT_FOUND_MESSAGE,
  IMPORT_JOB_NOT_FOUND_MESSAGE_KEY,
} from '../model/migration.constants';

export class ImportJobNotFoundError extends NotFoundError {
  constructor() {
    super(IMPORT_JOB_NOT_FOUND_MESSAGE, IMPORT_JOB_NOT_FOUND_MESSAGE_KEY);
  }
}
