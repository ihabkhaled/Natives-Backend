import { NotFoundError } from '@core/errors/not-found.error';

import {
  DATA_QUALITY_SCOPE_NOT_FOUND_MESSAGE,
  DATA_QUALITY_SCOPE_NOT_FOUND_MESSAGE_KEY,
} from '../model/dataquality.constants';

export class DataQualityScopeNotFoundError extends NotFoundError {
  constructor() {
    super(
      DATA_QUALITY_SCOPE_NOT_FOUND_MESSAGE,
      DATA_QUALITY_SCOPE_NOT_FOUND_MESSAGE_KEY,
    );
  }
}
