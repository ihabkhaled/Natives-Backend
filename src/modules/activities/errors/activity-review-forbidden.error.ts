import { ForbiddenError } from '@core/errors/forbidden.error';

import {
  ACTIVITY_REVIEW_FORBIDDEN_MESSAGE,
  ACTIVITY_REVIEW_FORBIDDEN_MESSAGE_KEY,
} from '../model/activities.constants';

/**
 * Raised (403) when a reviewer attempts to act on a submission they may not
 * moderate: their own claim (self-review) or one where they are a credited
 * training buddy. Enforced server-side; hiding the control in the UI is not proof.
 */
export class ActivityReviewForbiddenError extends ForbiddenError {
  constructor() {
    super(
      ACTIVITY_REVIEW_FORBIDDEN_MESSAGE,
      ACTIVITY_REVIEW_FORBIDDEN_MESSAGE_KEY,
    );
  }
}
