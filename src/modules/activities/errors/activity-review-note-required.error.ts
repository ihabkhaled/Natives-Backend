import { ValidationError } from '@core/errors/validation.error';

import {
  ACTIVITY_REVIEW_NOTE_REQUIRED_MESSAGE,
  ACTIVITY_REVIEW_NOTE_REQUIRED_MESSAGE_KEY,
} from '../model/activities.constants';

/**
 * Raised (400) when a reject or request-changes decision omits the structured
 * reviewer note. Denial paths must always carry a member-safe reason.
 */
export class ActivityReviewNoteRequiredError extends ValidationError {
  constructor() {
    super(
      ACTIVITY_REVIEW_NOTE_REQUIRED_MESSAGE,
      ACTIVITY_REVIEW_NOTE_REQUIRED_MESSAGE_KEY,
    );
  }
}
