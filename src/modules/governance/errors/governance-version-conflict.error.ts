import { ConflictError } from '@core/errors/conflict.error';

import {
  GOVERNANCE_VERSION_CONFLICT_MESSAGE,
  GOVERNANCE_VERSION_CONFLICT_MESSAGE_KEY,
} from '../model/governance.constants';

export class GovernanceVersionConflictError extends ConflictError {
  constructor() {
    super(
      GOVERNANCE_VERSION_CONFLICT_MESSAGE,
      GOVERNANCE_VERSION_CONFLICT_MESSAGE_KEY,
    );
  }
}
