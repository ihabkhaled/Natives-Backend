import { NotFoundError } from '@core/errors/not-found.error';

import {
  FIXTURE_NOT_FOUND_MESSAGE,
  FIXTURE_NOT_FOUND_MESSAGE_KEY,
} from '../model/competitions.constants';

export class FixtureNotFoundError extends NotFoundError {
  constructor() {
    super(FIXTURE_NOT_FOUND_MESSAGE, FIXTURE_NOT_FOUND_MESSAGE_KEY);
  }
}
