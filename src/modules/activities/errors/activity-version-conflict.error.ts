import { ConflictError } from '@core/errors/conflict.error';

import {
  ACTIVITY_VERSION_CONFLICT_MESSAGE,
  ACTIVITY_VERSION_CONFLICT_MESSAGE_KEY,
} from '../model/activities.constants';

export class ActivityVersionConflictError extends ConflictError {
  constructor() {
    super(
      ACTIVITY_VERSION_CONFLICT_MESSAGE,
      ACTIVITY_VERSION_CONFLICT_MESSAGE_KEY,
    );
  }
}
