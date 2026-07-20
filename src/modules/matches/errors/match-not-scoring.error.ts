import { ConflictError } from '@core/errors/conflict.error';

import {
  MATCH_NOT_SCORING_MESSAGE,
  MATCH_NOT_SCORING_MESSAGE_KEY,
} from '../model/matches.constants';

export class MatchNotScoringError extends ConflictError {
  constructor() {
    super(MATCH_NOT_SCORING_MESSAGE, MATCH_NOT_SCORING_MESSAGE_KEY);
  }
}
