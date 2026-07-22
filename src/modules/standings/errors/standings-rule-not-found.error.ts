import { NotFoundError } from '@core/errors/not-found.error';

import {
  STANDINGS_RULE_NOT_FOUND_MESSAGE,
  STANDINGS_RULE_NOT_FOUND_MESSAGE_KEY,
} from '../model/standings.constants';

export class StandingsRuleNotFoundError extends NotFoundError {
  constructor() {
    super(
      STANDINGS_RULE_NOT_FOUND_MESSAGE,
      STANDINGS_RULE_NOT_FOUND_MESSAGE_KEY,
    );
  }
}
