import { ForbiddenError } from '@core/errors/forbidden.error';

import {
  ASSESSMENT_SELF_APPROVAL_MESSAGE,
  ASSESSMENT_SELF_APPROVAL_MESSAGE_KEY,
} from '../model/player-assessments.constants';

export class AssessmentSelfApprovalError extends ForbiddenError {
  constructor() {
    super(
      ASSESSMENT_SELF_APPROVAL_MESSAGE,
      ASSESSMENT_SELF_APPROVAL_MESSAGE_KEY,
    );
  }
}
