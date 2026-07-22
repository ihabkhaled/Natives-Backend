import { ConflictError } from '@core/errors/conflict.error';

import {
  MIGRATION_VERSION_CONFLICT_MESSAGE,
  MIGRATION_VERSION_CONFLICT_MESSAGE_KEY,
} from '../model/migration.constants';

export class MigrationVersionConflictError extends ConflictError {
  constructor() {
    super(
      MIGRATION_VERSION_CONFLICT_MESSAGE,
      MIGRATION_VERSION_CONFLICT_MESSAGE_KEY,
    );
  }
}
