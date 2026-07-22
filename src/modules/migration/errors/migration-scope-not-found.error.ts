import { NotFoundError } from '@core/errors/not-found.error';

import {
  MIGRATION_SCOPE_NOT_FOUND_MESSAGE,
  MIGRATION_SCOPE_NOT_FOUND_MESSAGE_KEY,
} from '../model/migration.constants';

export class MigrationScopeNotFoundError extends NotFoundError {
  constructor() {
    super(
      MIGRATION_SCOPE_NOT_FOUND_MESSAGE,
      MIGRATION_SCOPE_NOT_FOUND_MESSAGE_KEY,
    );
  }
}
