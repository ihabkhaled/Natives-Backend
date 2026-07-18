import { ConflictError } from '@core/errors/conflict.error';

import {
  ASSESSMENT_TEMPLATE_LOCKED_MESSAGE,
  ASSESSMENT_TEMPLATE_LOCKED_MESSAGE_KEY,
} from '../model/assessments.constants';

export class AssessmentTemplateLockedError extends ConflictError {
  constructor() {
    super(
      ASSESSMENT_TEMPLATE_LOCKED_MESSAGE,
      ASSESSMENT_TEMPLATE_LOCKED_MESSAGE_KEY,
    );
  }
}
