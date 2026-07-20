import { ForbiddenError } from '@core/errors/forbidden.error';

import {
  DASHBOARD_TEAM_FORBIDDEN_MESSAGE,
  DASHBOARD_TEAM_FORBIDDEN_MESSAGE_KEY,
} from '../model/dashboard.constants';

/**
 * Raised when a caller asks for a summary of a team they hold no membership in.
 * The permission guard already denies a scoped grant for another team; this is
 * the ownership check that also stops a globally-privileged principal from
 * reading a team dashboard they are not part of.
 */
export class DashboardTeamForbiddenError extends ForbiddenError {
  constructor() {
    super(
      DASHBOARD_TEAM_FORBIDDEN_MESSAGE,
      DASHBOARD_TEAM_FORBIDDEN_MESSAGE_KEY,
    );
  }
}
