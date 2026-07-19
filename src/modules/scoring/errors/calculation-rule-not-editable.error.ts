import { ConflictError } from '@core/errors/conflict.error';

import {
  RULE_NOT_EDITABLE_MESSAGE,
  RULE_NOT_EDITABLE_MESSAGE_KEY,
} from '../model/scoring.constants';

export class CalculationRuleNotEditableError extends ConflictError {
  constructor() {
    super(RULE_NOT_EDITABLE_MESSAGE, RULE_NOT_EDITABLE_MESSAGE_KEY);
  }
}
