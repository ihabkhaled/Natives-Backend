import { NotFoundError } from '@core/errors/not-found.error';

import {
  ACTIVITY_SCOPE_NOT_FOUND_MESSAGE,
  ACTIVITY_SCOPE_NOT_FOUND_MESSAGE_KEY,
} from '../model/activities.constants';

export class ActivityScopeNotFoundError extends NotFoundError {
  constructor() {
    super(
      ACTIVITY_SCOPE_NOT_FOUND_MESSAGE,
      ACTIVITY_SCOPE_NOT_FOUND_MESSAGE_KEY,
    );
  }
}
