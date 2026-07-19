import { NotFoundError } from '@core/errors/not-found.error';

import {
  POINTS_SCOPE_NOT_FOUND_MESSAGE,
  POINTS_SCOPE_NOT_FOUND_MESSAGE_KEY,
} from '../model/points.constants';

export class PointsScopeNotFoundError extends NotFoundError {
  constructor() {
    super(POINTS_SCOPE_NOT_FOUND_MESSAGE, POINTS_SCOPE_NOT_FOUND_MESSAGE_KEY);
  }
}
