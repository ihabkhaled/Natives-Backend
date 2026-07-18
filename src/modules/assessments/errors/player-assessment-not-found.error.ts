import { NotFoundError } from '@core/errors/not-found.error';

import {
  PLAYER_ASSESSMENT_NOT_FOUND_MESSAGE,
  PLAYER_ASSESSMENT_NOT_FOUND_MESSAGE_KEY,
} from '../model/player-assessments.constants';

export class PlayerAssessmentNotFoundError extends NotFoundError {
  constructor() {
    super(
      PLAYER_ASSESSMENT_NOT_FOUND_MESSAGE,
      PLAYER_ASSESSMENT_NOT_FOUND_MESSAGE_KEY,
    );
  }
}
