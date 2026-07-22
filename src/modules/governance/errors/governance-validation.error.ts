import { ValidationError } from '@core/errors/validation.error';

import {
  GOVERNANCE_VALIDATION_MESSAGE,
  GOVERNANCE_VALIDATION_MESSAGE_KEY,
} from '../model/governance.constants';

export class GovernanceValidationError extends ValidationError {
  constructor() {
    super(GOVERNANCE_VALIDATION_MESSAGE, GOVERNANCE_VALIDATION_MESSAGE_KEY);
  }
}
