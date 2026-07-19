import { NotFoundError } from '@core/errors/not-found.error';

import {
  DEVELOPMENT_SCOPE_NOT_FOUND_MESSAGE,
  DEVELOPMENT_SCOPE_NOT_FOUND_MESSAGE_KEY,
} from '../model/development.constants';

export class DevelopmentScopeNotFoundError extends NotFoundError {
  constructor() {
    super(
      DEVELOPMENT_SCOPE_NOT_FOUND_MESSAGE,
      DEVELOPMENT_SCOPE_NOT_FOUND_MESSAGE_KEY,
    );
  }
}
