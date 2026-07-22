import { NotFoundError } from '@core/errors/not-found.error';

import {
  TRYOUT_SCOPE_NOT_FOUND_MESSAGE,
  TRYOUT_SCOPE_NOT_FOUND_MESSAGE_KEY,
} from '../model/tryouts.constants';

export class TryoutScopeNotFoundError extends NotFoundError {
  constructor() {
    super(TRYOUT_SCOPE_NOT_FOUND_MESSAGE, TRYOUT_SCOPE_NOT_FOUND_MESSAGE_KEY);
  }
}
