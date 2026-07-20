import { ForbiddenError } from '@core/errors/forbidden.error';
import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { DASHBOARD_TEAM_FORBIDDEN_MESSAGE_KEY } from '../model/dashboard.constants';
import { DashboardTeamForbiddenError } from './dashboard-team-forbidden.error';

describe('DashboardTeamForbiddenError', () => {
  it('carries the safe forbidden contract', () => {
    const error = new DashboardTeamForbiddenError();

    expect(error).toBeInstanceOf(ForbiddenError);
    expect(error.status).toBe(HttpStatus.FORBIDDEN);
    expect(error.messageKey).toBe(DASHBOARD_TEAM_FORBIDDEN_MESSAGE_KEY);
  });
});
