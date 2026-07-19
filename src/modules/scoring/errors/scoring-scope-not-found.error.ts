import { NotFoundError } from '@core/errors/not-found.error';

import {
  SCORING_SCOPE_NOT_FOUND_MESSAGE,
  SCORING_SCOPE_NOT_FOUND_MESSAGE_KEY,
} from '../model/scoring.constants';

export class ScoringScopeNotFoundError extends NotFoundError {
  constructor() {
    super(SCORING_SCOPE_NOT_FOUND_MESSAGE, SCORING_SCOPE_NOT_FOUND_MESSAGE_KEY);
  }
}
