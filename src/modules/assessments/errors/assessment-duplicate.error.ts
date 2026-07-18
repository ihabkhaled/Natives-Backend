import { ConflictError } from '@core/errors/conflict.error';

import {
  ASSESSMENT_DUPLICATE_MESSAGE,
  ASSESSMENT_DUPLICATE_MESSAGE_KEY,
} from '../model/assessments.constants';

export class AssessmentDuplicateError extends ConflictError {
  constructor() {
    super(ASSESSMENT_DUPLICATE_MESSAGE, ASSESSMENT_DUPLICATE_MESSAGE_KEY);
  }
}

