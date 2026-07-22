import { NotFoundError } from '@core/errors/not-found.error';

import {
  ANOMALY_NOT_FOUND_MESSAGE,
  ANOMALY_NOT_FOUND_MESSAGE_KEY,
} from '../model/dataquality.constants';

export class AnomalyNotFoundError extends NotFoundError {
  constructor() {
    super(ANOMALY_NOT_FOUND_MESSAGE, ANOMALY_NOT_FOUND_MESSAGE_KEY);
  }
}
