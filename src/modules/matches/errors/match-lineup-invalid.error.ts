import { ValidationError } from '@core/errors/validation.error';

import {
  MATCH_LINEUP_INVALID_MESSAGE,
  MATCH_LINEUP_INVALID_MESSAGE_KEY,
} from '../model/matches.constants';

export class MatchLineupInvalidError extends ValidationError {
  constructor() {
    super(MATCH_LINEUP_INVALID_MESSAGE, MATCH_LINEUP_INVALID_MESSAGE_KEY);
  }
}
