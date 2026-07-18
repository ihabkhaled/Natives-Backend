import { ForbiddenError } from '@core/errors/forbidden.error';

import {
  RSVP_NOT_MEMBER_MESSAGE,
  RSVP_NOT_MEMBER_MESSAGE_KEY,
} from '../model/rsvp.constants';

/**
 * Raised when a caller with the self-RSVP permission has no active membership in
 * the target team — the team/season-scope + active-membership authorization check
 * that the global permission guard cannot express.
 */
export class RsvpNotMemberError extends ForbiddenError {
  constructor() {
    super(RSVP_NOT_MEMBER_MESSAGE, RSVP_NOT_MEMBER_MESSAGE_KEY);
  }
}
