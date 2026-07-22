import { ForbiddenError } from '@core/errors/forbidden.error';

import {
  TRYOUT_RESTRICTED_MESSAGE,
  TRYOUT_RESTRICTED_MESSAGE_KEY,
} from '../model/tryouts.constants';

export class TryoutRestrictedError extends ForbiddenError {
  constructor() {
    super(TRYOUT_RESTRICTED_MESSAGE, TRYOUT_RESTRICTED_MESSAGE_KEY);
  }
}
