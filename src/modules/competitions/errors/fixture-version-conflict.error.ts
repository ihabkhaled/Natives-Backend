import { ConflictError } from '@core/errors/conflict.error';

import {
  FIXTURE_VERSION_CONFLICT_MESSAGE,
  FIXTURE_VERSION_CONFLICT_MESSAGE_KEY,
} from '../model/competitions.constants';

export class FixtureVersionConflictError extends ConflictError {
  constructor() {
    super(
      FIXTURE_VERSION_CONFLICT_MESSAGE,
      FIXTURE_VERSION_CONFLICT_MESSAGE_KEY,
    );
  }
}
