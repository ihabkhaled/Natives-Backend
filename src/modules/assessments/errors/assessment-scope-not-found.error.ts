import { NotFoundError } from '@core/errors/not-found.error';

import {
  ASSESSMENT_SCOPE_NOT_FOUND_MESSAGE,
  ASSESSMENT_SCOPE_NOT_FOUND_MESSAGE_KEY,
} from '../model/assessments.constants';

export class AssessmentScopeNotFoundError extends NotFoundError {
  constructor() {
    super(
      ASSESSMENT_SCOPE_NOT_FOUND_MESSAGE,
      ASSESSMENT_SCOPE_NOT_FOUND_MESSAGE_KEY,
    );
  }
}

