import { NotFoundError } from '@core/errors/not-found.error';

import {
  RULE_NOT_FOUND_MESSAGE,
  RULE_NOT_FOUND_MESSAGE_KEY,
} from '../model/scoring.constants';

export class CalculationRuleNotFoundError extends NotFoundError {
  constructor() {
    super(RULE_NOT_FOUND_MESSAGE, RULE_NOT_FOUND_MESSAGE_KEY);
  }
}
