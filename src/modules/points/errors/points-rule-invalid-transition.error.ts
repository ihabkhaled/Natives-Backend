import { ConflictError } from '@core/errors/conflict.error';

import {
  RULE_INVALID_TRANSITION_MESSAGE,
  RULE_INVALID_TRANSITION_MESSAGE_KEY,
} from '../model/points.constants';

export class PointsRuleInvalidTransitionError extends ConflictError {
  constructor() {
    super(RULE_INVALID_TRANSITION_MESSAGE, RULE_INVALID_TRANSITION_MESSAGE_KEY);
  }
}
