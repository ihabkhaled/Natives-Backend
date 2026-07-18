import { UnauthorizedError } from '@core/errors/unauthorized.error';

import {
  SESSION_CONTEXT_REQUIRED_MESSAGE,
  SESSION_CONTEXT_REQUIRED_MESSAGE_KEY,
} from '../model/identity.constants';

export class SessionContextRequiredError extends UnauthorizedError {
  constructor() {
    super(
      SESSION_CONTEXT_REQUIRED_MESSAGE,
      SESSION_CONTEXT_REQUIRED_MESSAGE_KEY,
    );
  }
}
