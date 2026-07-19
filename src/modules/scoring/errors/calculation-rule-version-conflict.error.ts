import { ConflictError } from '@core/errors/conflict.error';

import {
  RULE_VERSION_CONFLICT_MESSAGE,
  RULE_VERSION_CONFLICT_MESSAGE_KEY,
} from '../model/scoring.constants';

export class CalculationRuleVersionConflictError extends ConflictError {
  constructor() {
    super(RULE_VERSION_CONFLICT_MESSAGE, RULE_VERSION_CONFLICT_MESSAGE_KEY);
  }
}
