import { NotFoundError } from '@core/errors/not-found.error';

import {
  ANALYTICS_SCOPE_NOT_FOUND_MESSAGE,
  ANALYTICS_SCOPE_NOT_FOUND_MESSAGE_KEY,
} from '../model/analytics.constants';

export class AnalyticsScopeNotFoundError extends NotFoundError {
  constructor() {
    super(
      ANALYTICS_SCOPE_NOT_FOUND_MESSAGE,
      ANALYTICS_SCOPE_NOT_FOUND_MESSAGE_KEY,
    );
  }
}
