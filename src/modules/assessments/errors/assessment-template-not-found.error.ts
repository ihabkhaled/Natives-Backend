import { NotFoundError } from '@core/errors/not-found.error';

import {
  ASSESSMENT_TEMPLATE_NOT_FOUND_MESSAGE,
  ASSESSMENT_TEMPLATE_NOT_FOUND_MESSAGE_KEY,
} from '../model/assessments.constants';

export class AssessmentTemplateNotFoundError extends NotFoundError {
  constructor() {
    super(
      ASSESSMENT_TEMPLATE_NOT_FOUND_MESSAGE,
      ASSESSMENT_TEMPLATE_NOT_FOUND_MESSAGE_KEY,
    );
  }
}

