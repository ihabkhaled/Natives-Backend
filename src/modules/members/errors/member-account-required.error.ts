import { ConflictError } from '@core/errors/conflict.error';

import {
  MEMBER_ACCOUNT_REQUIRED_MESSAGE,
  MEMBER_ACCOUNT_REQUIRED_MESSAGE_KEY,
} from '../model/members.constants';

/**
 * Raised when role assignment targets a membership with no linked user account.
 * Roles are granted to accounts, so a historical player or an unclaimed invite
 * cannot hold one until that link exists.
 */
export class MemberAccountRequiredError extends ConflictError {
  constructor() {
    super(MEMBER_ACCOUNT_REQUIRED_MESSAGE, MEMBER_ACCOUNT_REQUIRED_MESSAGE_KEY);
  }
}
