import { ForbiddenError } from '@core/errors/forbidden.error';

import {
  PROFILE_FORBIDDEN_MESSAGE,
  PROFILE_FORBIDDEN_MESSAGE_KEY,
} from '../model/members.constants';

/**
 * Raised when a principal tries to modify a member profile they neither own nor
 * hold an elevated management permission for (ownership-or-elevated invariant).
 */
export class ProfileForbiddenError extends ForbiddenError {
  constructor() {
    super(PROFILE_FORBIDDEN_MESSAGE, PROFILE_FORBIDDEN_MESSAGE_KEY);
  }
}
