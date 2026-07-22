import { ForbiddenError } from '@core/errors/forbidden.error';

import {
  COHORT_TOO_SMALL_MESSAGE,
  COHORT_TOO_SMALL_MESSAGE_KEY,
} from '../model/analytics.constants';

export class CohortTooSmallError extends ForbiddenError {
  constructor() {
    super(COHORT_TOO_SMALL_MESSAGE, COHORT_TOO_SMALL_MESSAGE_KEY);
  }
}
