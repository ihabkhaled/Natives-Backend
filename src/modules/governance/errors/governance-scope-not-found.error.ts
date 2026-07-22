import { NotFoundError } from '@core/errors/not-found.error';

import {
  GOVERNANCE_SCOPE_NOT_FOUND_MESSAGE,
  GOVERNANCE_SCOPE_NOT_FOUND_MESSAGE_KEY,
} from '../model/governance.constants';

export class GovernanceScopeNotFoundError extends NotFoundError {
  constructor() {
    super(
      GOVERNANCE_SCOPE_NOT_FOUND_MESSAGE,
      GOVERNANCE_SCOPE_NOT_FOUND_MESSAGE_KEY,
    );
  }
}
