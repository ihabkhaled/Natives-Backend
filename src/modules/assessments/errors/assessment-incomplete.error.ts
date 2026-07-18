import { ValidationError } from '@core/errors/validation.error';

import {
  ASSESSMENT_INCOMPLETE_MESSAGE,
  ASSESSMENT_INCOMPLETE_MESSAGE_KEY,
} from '../model/player-assessments.constants';

export class AssessmentIncompleteError extends ValidationError {
  constructor() {
    super(ASSESSMENT_INCOMPLETE_MESSAGE, ASSESSMENT_INCOMPLETE_MESSAGE_KEY);
  }
}
