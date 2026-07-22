import { NotFoundError } from '@core/errors/not-found.error';

import {
  STANDINGS_SCOPE_NOT_FOUND_MESSAGE,
  STANDINGS_SCOPE_NOT_FOUND_MESSAGE_KEY,
} from '../model/standings.constants';

export class StandingsScopeNotFoundError extends NotFoundError {
  constructor() {
    super(
      STANDINGS_SCOPE_NOT_FOUND_MESSAGE,
      STANDINGS_SCOPE_NOT_FOUND_MESSAGE_KEY,
    );
  }
}
