import { ConflictError } from '@core/errors/conflict.error';

import {
  ANOMALY_INVALID_TRANSITION_MESSAGE,
  ANOMALY_INVALID_TRANSITION_MESSAGE_KEY,
} from '../model/dataquality.constants';

export class AnomalyInvalidTransitionError extends ConflictError {
  constructor() {
    super(
      ANOMALY_INVALID_TRANSITION_MESSAGE,
      ANOMALY_INVALID_TRANSITION_MESSAGE_KEY,
    );
  }
}
