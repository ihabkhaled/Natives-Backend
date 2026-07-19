import { ConflictError } from '@core/errors/conflict.error';

import {
  RULE_VERSION_CONFLICT_MESSAGE,
  RULE_VERSION_CONFLICT_MESSAGE_KEY,
} from '../model/points.constants';

export class PointsRuleVersionConflictError extends ConflictError {
  constructor() {
    super(RULE_VERSION_CONFLICT_MESSAGE, RULE_VERSION_CONFLICT_MESSAGE_KEY);
  }
}
