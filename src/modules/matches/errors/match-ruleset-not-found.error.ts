import { NotFoundError } from '@core/errors/not-found.error';

import {
  MATCH_RULESET_NOT_FOUND_MESSAGE,
  MATCH_RULESET_NOT_FOUND_MESSAGE_KEY,
} from '../model/matches.constants';

export class MatchRulesetNotFoundError extends NotFoundError {
  constructor() {
    super(MATCH_RULESET_NOT_FOUND_MESSAGE, MATCH_RULESET_NOT_FOUND_MESSAGE_KEY);
  }
}
