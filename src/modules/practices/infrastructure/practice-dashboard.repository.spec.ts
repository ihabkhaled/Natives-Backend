import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ATTENDANCE_SHEET_OPEN_STATE,
  ATTENDANCE_STATUS_MAX,
  SESSION_DRAFT_STATE,
  SESSION_PUBLISHED_STATE,
  UPCOMING_SESSIONS_MAX,
} from '../model/signals.constants';
import { PracticeDashboardRepository } from './practice-dashboard.repository';

const NOW = new Date('2026-07-20T12:00:00.000Z');

describe('PracticeDashboardRepository', () => {
  let repository: PracticeDashboardRepository;
  let scope: { run: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repository = new PracticeDashboardRepository();
    scope = { run: vi.fn().mockResolvedValue([]) };
  });

  it('bounds the upcoming-session read and joins the viewer RSVP', async () => {
    await repository.listUpcomingSessions(
      scope as never,
      'team-1',
      'membership-1',
      NOW,
    );

    expect(scope.run.mock.calls[0]?.[0]).toContain(
      'LEFT JOIN "practice_rsvps"',
    );
    expect(scope.run.mock.calls[0]?.[1]).toEqual([
      'team-1',
      NOW.toISOString(),
      'membership-1',
      SESSION_PUBLISHED_STATE,
      UPCOMING_SESSIONS_MAX,
    ]);
  });

  it('passes a null membership so a viewer without one still sees sessions', async () => {
    await repository.listUpcomingSessions(scope as never, 'team-1', null, NOW);

    expect(scope.run.mock.calls[0]?.[1]?.[2]).toBeNull();
  });

  it('groups attendance by status under an explicit bound', async () => {
    await repository.listAttendanceCounts(
      scope as never,
      'team-1',
      'membership-1',
    );

    expect(scope.run.mock.calls[0]?.[0]).toContain('GROUP BY');
    expect(scope.run.mock.calls[0]?.[1]).toEqual([
      'team-1',
      'membership-1',
      ATTENDANCE_STATUS_MAX,
    ]);
  });

  it('counts only future draft sessions', async () => {
    await repository.countDraftSessions(scope as never, 'team-1', NOW);

    expect(scope.run.mock.calls[0]?.[1]).toEqual([
      'team-1',
      NOW.toISOString(),
      SESSION_DRAFT_STATE,
    ]);
  });

  it('counts only open sheets for sessions that already happened', async () => {
    await repository.countOpenAttendanceSheets(scope as never, 'team-1', NOW);

    expect(scope.run.mock.calls[0]?.[0]).toContain('"p"."starts_at" < $2');
    expect(scope.run.mock.calls[0]?.[1]).toEqual([
      'team-1',
      NOW.toISOString(),
      ATTENDANCE_SHEET_OPEN_STATE,
    ]);
  });
});
