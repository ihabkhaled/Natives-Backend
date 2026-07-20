import { NotFoundError } from '@core/errors/not-found.error';

import {
  SCOPE_NOT_FOUND_MESSAGE,
  SCOPE_NOT_FOUND_MESSAGE_KEY,
} from '../model/competitions.constants';

export class CompetitionScopeNotFoundError extends NotFoundError {
  constructor() {
    super(SCOPE_NOT_FOUND_MESSAGE, SCOPE_NOT_FOUND_MESSAGE_KEY);
  }
}
