import { ConflictError } from '@core/errors/conflict.error';

import {
  DATA_QUALITY_VERSION_CONFLICT_MESSAGE,
  DATA_QUALITY_VERSION_CONFLICT_MESSAGE_KEY,
} from '../model/dataquality.constants';

export class DataQualityVersionConflictError extends ConflictError {
  constructor() {
    super(
      DATA_QUALITY_VERSION_CONFLICT_MESSAGE,
      DATA_QUALITY_VERSION_CONFLICT_MESSAGE_KEY,
    );
  }
}
