import { ConflictError } from '@core/errors/conflict.error';

import {
  ADJUSTMENT_CONFLICT_MESSAGE,
  ADJUSTMENT_CONFLICT_MESSAGE_KEY,
} from '../model/points.constants';

export class PointsAdjustmentConflictError extends ConflictError {
  constructor() {
    super(ADJUSTMENT_CONFLICT_MESSAGE, ADJUSTMENT_CONFLICT_MESSAGE_KEY);
  }
}
