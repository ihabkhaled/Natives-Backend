import { NotFoundError } from '@core/errors/not-found.error';

import {
  COMPARISON_NOT_FOUND_MESSAGE,
  COMPARISON_NOT_FOUND_MESSAGE_KEY,
} from '../model/migration.constants';

export class ComparisonNotFoundError extends NotFoundError {
  constructor() {
    super(COMPARISON_NOT_FOUND_MESSAGE, COMPARISON_NOT_FOUND_MESSAGE_KEY);
  }
}
