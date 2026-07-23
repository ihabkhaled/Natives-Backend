import { ForbiddenError } from '@core/errors/forbidden.error';

import {
  RULE_ACK_FORBIDDEN_MESSAGE,
  RULE_ACK_FORBIDDEN_MESSAGE_KEY,
} from '../model/governance.constants';

/**
 * Raised when an actor tries to record a rule acknowledgement for a membership
 * that is not their own (BE-3). An acknowledgement is a personal legal act —
 * nobody accepts a rule on somebody else's behalf.
 */
export class RuleAcknowledgementForbiddenError extends ForbiddenError {
  constructor() {
    super(RULE_ACK_FORBIDDEN_MESSAGE, RULE_ACK_FORBIDDEN_MESSAGE_KEY);
  }
}
