import { ConflictError } from '@core/errors/conflict.error';

import {
  GOVERNANCE_INVALID_TRANSITION_MESSAGE,
  GOVERNANCE_INVALID_TRANSITION_MESSAGE_KEY,
} from '../model/governance.constants';

export class GovernanceInvalidTransitionError extends ConflictError {
  constructor() {
    super(
      GOVERNANCE_INVALID_TRANSITION_MESSAGE,
      GOVERNANCE_INVALID_TRANSITION_MESSAGE_KEY,
    );
  }
}
