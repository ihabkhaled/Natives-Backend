import { NotFoundError } from '@core/errors/not-found.error';

import {
  RULE_NOT_FOUND_MESSAGE,
  RULE_NOT_FOUND_MESSAGE_KEY,
} from '../model/governance.constants';

export class RuleNotFoundError extends NotFoundError {
  constructor() {
    super(RULE_NOT_FOUND_MESSAGE, RULE_NOT_FOUND_MESSAGE_KEY);
  }
}
