import { NotFoundError } from '@core/errors/not-found.error';

import {
  CANDIDATE_NOT_FOUND_MESSAGE,
  CANDIDATE_NOT_FOUND_MESSAGE_KEY,
} from '../model/squads.constants';

export class CandidateNotFoundError extends NotFoundError {
  constructor() {
    super(CANDIDATE_NOT_FOUND_MESSAGE, CANDIDATE_NOT_FOUND_MESSAGE_KEY);
  }
}
