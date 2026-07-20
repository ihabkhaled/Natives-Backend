import { ConflictError } from '@core/errors/conflict.error';

import {
  ELIGIBILITY_OVERRIDE_REQUIRED_MESSAGE,
  ELIGIBILITY_OVERRIDE_REQUIRED_MESSAGE_KEY,
} from '../model/squads.constants';

/**
 * Raised when a coach selects a player an eligibility signal flags without an
 * explicit override. The signal never excludes the player automatically — this
 * simply requires a permitted human to consciously accept the flag with a reason.
 */
export class EligibilityOverrideRequiredError extends ConflictError {
  constructor() {
    super(
      ELIGIBILITY_OVERRIDE_REQUIRED_MESSAGE,
      ELIGIBILITY_OVERRIDE_REQUIRED_MESSAGE_KEY,
    );
  }
}
