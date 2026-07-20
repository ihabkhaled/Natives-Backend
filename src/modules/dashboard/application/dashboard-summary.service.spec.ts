import type { AuthUserIdentity } from '@core/auth';
import { Permission } from '@shared/enums';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DashboardPersona } from '../model/dashboard.enums';
import type { DashboardSignalBundle } from '../model/dashboard.types';
import { DashboardSummaryService } from './dashboard-summary.service';

const NOW = new Date('2026-07-20T12:00:00.000Z');

const ACTOR: AuthUserIdentity = {
  userId: 'user-1',
  email: 'member@example.test',
  roles: [],
};

const SIGNALS: DashboardSignalBundle = {
  practices: {
    upcomingSessions: [],
    attendanceCounts: [],
    attendanceAsOf: null,
    draftSessions: { count: null, asOf: null },
    openAttendanceSheets: { count: null, asOf: null },
  },
  assessments: {
    publishedForViewer: { count: null, asOf: null },
    awaitingReview: { count: null, asOf: null },
  },
  points: { total: null, rank: null, population: null, asOf: null },
  members: {
    profileCompletenessPercent: null,
    profileAsOf: null,
    invitedMembers: { count: null, asOf: null },
  },
};

function build() {
  const clock = { now: vi.fn().mockReturnValue(NOW), uptime: vi.fn() };
  const resolver = {
    resolve: vi.fn().mockResolvedValue(new Set([Permission.PracticeRead])),
  };
  const scopes = {
    resolve: vi.fn().mockResolvedValue({
      teamId: 'team-1',
      seasonId: 'season-1',
      membershipId: 'membership-1',
    }),
  };
  const signals = { collect: vi.fn().mockResolvedValue(SIGNALS) };
  const service = new DashboardSummaryService(
    clock,
    resolver,
    scopes as never,
    signals as never,
  );
  return { clock, resolver, scopes, service, signals };
}

describe('DashboardSummaryService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('resolves permissions inside the caller team and season scope', async () => {
    const summary = await harness.service.summarize(ACTOR, null);

    expect(harness.resolver.resolve).toHaveBeenCalledWith(ACTOR, {
      teamId: 'team-1',
      seasonId: 'season-1',
    });
    expect(summary.generatedAt).toBe(NOW);
    expect(summary.persona).toBe(DashboardPersona.Member);
    expect(summary.widgets.map(widget => widget.kind)).toEqual([
      'member-schedule',
    ]);
  });

  it('omits the season dimension when the team has no season', async () => {
    harness.scopes.resolve.mockResolvedValue({
      teamId: 'team-1',
      seasonId: null,
      membershipId: 'membership-1',
    });

    await harness.service.summarize(ACTOR, null);

    expect(harness.resolver.resolve).toHaveBeenCalledWith(ACTOR, {
      teamId: 'team-1',
    });
  });

  it('returns an empty projection and reads nothing without a team scope', async () => {
    harness.scopes.resolve.mockResolvedValue(null);

    const summary = await harness.service.summarize(ACTOR, null);

    expect(summary.widgets).toEqual([]);
    expect(harness.signals.collect).not.toHaveBeenCalled();
    expect(harness.resolver.resolve).toHaveBeenCalledWith(ACTOR, {});
  });

  it('classifies the persona from the scoped permissions', async () => {
    harness.resolver.resolve.mockResolvedValue(
      new Set([Permission.TeamSettingsManage]),
    );

    const summary = await harness.service.summarize(ACTOR, 'team-1');

    expect(summary.persona).toBe(DashboardPersona.Administrator);
    expect(harness.scopes.resolve).toHaveBeenCalledWith('user-1', 'team-1');
  });
});
