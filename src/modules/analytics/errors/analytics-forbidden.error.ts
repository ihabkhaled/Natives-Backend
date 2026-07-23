import { ForbiddenError } from '@core/errors/forbidden.error';

import {
  ANALYTICS_FORBIDDEN_MESSAGE,
  ANALYTICS_FORBIDDEN_MESSAGE_KEY,
} from '../model/analytics.constants';

/**
 * Raised when the caller holds neither `analytics.read.team` nor a
 * self-scope-satisfying `analytics.read.self` for the requested subject (B3):
 * a member may read exactly their own series, never a teammate's.
 */
export class AnalyticsForbiddenError extends ForbiddenError {
  constructor() {
    super(ANALYTICS_FORBIDDEN_MESSAGE, ANALYTICS_FORBIDDEN_MESSAGE_KEY);
  }
}
