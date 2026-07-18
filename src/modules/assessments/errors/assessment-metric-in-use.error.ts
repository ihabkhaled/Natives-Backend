import { ConflictError } from '@core/errors/conflict.error';

import {
  ASSESSMENT_METRIC_IN_USE_MESSAGE,
  ASSESSMENT_METRIC_IN_USE_MESSAGE_KEY,
} from '../model/assessments.constants';

export class AssessmentMetricInUseError extends ConflictError {
  constructor() {
    super(
      ASSESSMENT_METRIC_IN_USE_MESSAGE,
      ASSESSMENT_METRIC_IN_USE_MESSAGE_KEY,
    );
  }
}
