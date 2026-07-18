import { ConflictError } from '@core/errors/conflict.error';

import {
  ASSESSMENT_VERSION_CONFLICT_MESSAGE,
  ASSESSMENT_VERSION_CONFLICT_MESSAGE_KEY,
} from '../model/assessments.constants';

export class AssessmentVersionConflictError extends ConflictError {
  constructor() {
    super(
      ASSESSMENT_VERSION_CONFLICT_MESSAGE,
      ASSESSMENT_VERSION_CONFLICT_MESSAGE_KEY,
    );
  }
}

