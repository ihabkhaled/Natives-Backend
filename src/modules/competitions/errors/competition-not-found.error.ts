import { NotFoundError } from '@core/errors/not-found.error';

import {
  COMPETITION_NOT_FOUND_MESSAGE,
  COMPETITION_NOT_FOUND_MESSAGE_KEY,
} from '../model/competitions.constants';

export class CompetitionNotFoundError extends NotFoundError {
  constructor() {
    super(COMPETITION_NOT_FOUND_MESSAGE, COMPETITION_NOT_FOUND_MESSAGE_KEY);
  }
}
