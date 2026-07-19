import { ConflictError } from '@core/errors/conflict.error';

import {
  BUDDY_ALREADY_RESOLVED_MESSAGE,
  BUDDY_ALREADY_RESOLVED_MESSAGE_KEY,
} from '../model/activities.constants';

export class ActivityBuddyConflictError extends ConflictError {
  constructor() {
    super(BUDDY_ALREADY_RESOLVED_MESSAGE, BUDDY_ALREADY_RESOLVED_MESSAGE_KEY);
  }
}
