import { ConflictError } from '@core/errors/conflict.error';

import {
  COMPETITION_VERSION_CONFLICT_MESSAGE,
  COMPETITION_VERSION_CONFLICT_MESSAGE_KEY,
} from '../model/competitions.constants';

export class CompetitionVersionConflictError extends ConflictError {
  constructor() {
    super(
      COMPETITION_VERSION_CONFLICT_MESSAGE,
      COMPETITION_VERSION_CONFLICT_MESSAGE_KEY,
    );
  }
}
