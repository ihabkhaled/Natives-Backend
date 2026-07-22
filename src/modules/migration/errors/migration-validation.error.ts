import { ValidationError } from '@core/errors/validation.error';

import {
  MIGRATION_VALIDATION_MESSAGE,
  MIGRATION_VALIDATION_MESSAGE_KEY,
} from '../model/migration.constants';

export class MigrationValidationError extends ValidationError {
  constructor() {
    super(MIGRATION_VALIDATION_MESSAGE, MIGRATION_VALIDATION_MESSAGE_KEY);
  }
}
