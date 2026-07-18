import { ConflictError } from '@core/errors/conflict.error';

import {
  SEASON_OVERLAP_MESSAGE,
  SEASON_OVERLAP_MESSAGE_KEY,
} from '../model/teams.constants';

/** Raised when a season's date range overlaps an existing non-archived season. */
export class SeasonOverlapError extends ConflictError {
  constructor() {
    super(SEASON_OVERLAP_MESSAGE, SEASON_OVERLAP_MESSAGE_KEY);
  }
}
