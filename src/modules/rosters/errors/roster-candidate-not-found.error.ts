import { NotFoundError } from '@core/errors/not-found.error';

import {
  ROSTER_CANDIDATE_NOT_FOUND_MESSAGE,
  ROSTER_CANDIDATE_NOT_FOUND_MESSAGE_KEY,
} from '../model/rosters.constants';

export class RosterCandidateNotFoundError extends NotFoundError {
  constructor() {
    super(
      ROSTER_CANDIDATE_NOT_FOUND_MESSAGE,
      ROSTER_CANDIDATE_NOT_FOUND_MESSAGE_KEY,
    );
  }
}
