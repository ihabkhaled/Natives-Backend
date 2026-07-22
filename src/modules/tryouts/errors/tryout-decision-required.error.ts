import { ConflictError } from '@core/errors/conflict.error';

import {
  TRYOUT_DECISION_REQUIRED_MESSAGE,
  TRYOUT_DECISION_REQUIRED_MESSAGE_KEY,
} from '../model/tryouts.constants';

export class TryoutDecisionRequiredError extends ConflictError {
  constructor() {
    super(
      TRYOUT_DECISION_REQUIRED_MESSAGE,
      TRYOUT_DECISION_REQUIRED_MESSAGE_KEY,
    );
  }
}
