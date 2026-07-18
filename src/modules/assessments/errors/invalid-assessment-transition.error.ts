import { ConflictError } from '@core/errors/conflict.error';

import {
  ASSESSMENT_INVALID_TRANSITION_MESSAGE,
  ASSESSMENT_INVALID_TRANSITION_MESSAGE_KEY,
} from '../model/player-assessments.constants';

export class InvalidAssessmentTransitionError extends ConflictError {
  constructor() {
    super(
      ASSESSMENT_INVALID_TRANSITION_MESSAGE,
      ASSESSMENT_INVALID_TRANSITION_MESSAGE_KEY,
    );
  }
}
