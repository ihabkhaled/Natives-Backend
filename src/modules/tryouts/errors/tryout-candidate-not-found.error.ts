import { NotFoundError } from '@core/errors/not-found.error';

import {
  TRYOUT_CANDIDATE_NOT_FOUND_MESSAGE,
  TRYOUT_CANDIDATE_NOT_FOUND_MESSAGE_KEY,
} from '../model/tryouts.constants';

export class TryoutCandidateNotFoundError extends NotFoundError {
  constructor() {
    super(
      TRYOUT_CANDIDATE_NOT_FOUND_MESSAGE,
      TRYOUT_CANDIDATE_NOT_FOUND_MESSAGE_KEY,
    );
  }
}
