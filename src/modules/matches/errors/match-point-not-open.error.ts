import { ConflictError } from '@core/errors/conflict.error';

import {
  MATCH_POINT_NOT_OPEN_MESSAGE,
  MATCH_POINT_NOT_OPEN_MESSAGE_KEY,
} from '../model/matches.constants';

export class MatchPointNotOpenError extends ConflictError {
  constructor() {
    super(MATCH_POINT_NOT_OPEN_MESSAGE, MATCH_POINT_NOT_OPEN_MESSAGE_KEY);
  }
}
