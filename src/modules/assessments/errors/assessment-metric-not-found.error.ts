import { NotFoundError } from '@core/errors/not-found.error';

import {
  ASSESSMENT_METRIC_NOT_FOUND_MESSAGE,
  ASSESSMENT_METRIC_NOT_FOUND_MESSAGE_KEY,
} from '../model/assessments.constants';

export class AssessmentMetricNotFoundError extends NotFoundError {
  constructor() {
    super(
      ASSESSMENT_METRIC_NOT_FOUND_MESSAGE,
      ASSESSMENT_METRIC_NOT_FOUND_MESSAGE_KEY,
    );
  }
}
