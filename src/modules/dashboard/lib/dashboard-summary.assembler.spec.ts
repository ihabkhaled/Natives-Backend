import { Permission } from '@shared/enums';
import { describe, expect, it } from 'vitest';

import {
  DashboardPersona,
  DashboardWidgetKind,
} from '../model/dashboard.enums';
import type { DashboardSignalBundle } from '../model/dashboard.types';
import { assembleSummary } from './dashboard-summary.assembler';

const GENERATED_AT = new Date('2026-07-20T12:00:00.000Z');

const SIGNALS: DashboardSignalBundle = {
  practices: {
    upcomingSessions: [],
    attendanceCounts: [],
    attendanceAsOf: null,
    draftSessions: { count: 2, asOf: GENERATED_AT },
    openAttendanceSheets: { count: null, asOf: null },
  },
  assessments: {
    publishedForViewer: { count: null, asOf: null },
    awaitingReview: { count: 1, asOf: GENERATED_AT },
  },
  points: { total: null, rank: null, population: null, asOf: null },
  members: {
    profileCompletenessPercent: 50,
    profileAsOf: GENERATED_AT,
    invitedMembers: { count: 3, asOf: GENERATED_AT },
  },
};

const MEMBER_PERMISSIONS = new Set<string>([
  Permission.TeamRead,
  Permission.PracticeRead,
  Permission.AttendanceReadSelf,
  Permission.PointsReadSelf,
  Permission.LeaderboardRead,
  Permission.AssessmentReadSelfPublished,
  Permission.MemberProfileUpdateSelf,
]);

function kinds(permissions: ReadonlySet<string>): readonly string[] {
  return assembleSummary(
    {
      persona: DashboardPersona.Member,
      permissions,
      generatedAt: GENERATED_AT,
    },
    SIGNALS,
  ).widgets.map(widget => widget.kind);
}

describe('assembleSummary', () => {
  it('stamps the persona and the single generation instant', () => {
    const summary = assembleSummary(
      {
        persona: DashboardPersona.Coach,
        permissions: MEMBER_PERMISSIONS,
        generatedAt: GENERATED_AT,
      },
      SIGNALS,
    );

    expect(summary.persona).toBe(DashboardPersona.Coach);
    expect(summary.generatedAt).toBe(GENERATED_AT);
  });

  it('gives a plain member exactly the six member widgets', () => {
    expect(kinds(MEMBER_PERMISSIONS)).toEqual([
      DashboardWidgetKind.MemberSchedule,
      DashboardWidgetKind.MemberAttendance,
      DashboardWidgetKind.MemberStanding,
      DashboardWidgetKind.MemberActivity,
      DashboardWidgetKind.MemberFeedback,
      DashboardWidgetKind.MemberProfile,
    ]);
  });

  it('adds the coach widgets once the coaching permissions arrive', () => {
    const coach = new Set<string>([
      ...MEMBER_PERMISSIONS,
      Permission.PracticeManage,
      Permission.AttendanceFinalize,
      Permission.AssessmentReview,
      Permission.MemberList,
    ]);

    expect(kinds(coach)).toContain(DashboardWidgetKind.CoachSessions);
    expect(kinds(coach)).toContain(DashboardWidgetKind.CoachAttention);
    expect(kinds(coach)).toContain(DashboardWidgetKind.CoachAssessments);
    expect(kinds(coach)).toContain(DashboardWidgetKind.CoachRoster);
    expect(kinds(coach)).not.toContain(DashboardWidgetKind.AdminLifecycle);
  });

  it('adds the admin lifecycle widget for a lifecycle manager', () => {
    const admin = new Set<string>([
      ...MEMBER_PERMISSIONS,
      Permission.MemberLifecycleManage,
    ]);

    expect(kinds(admin)).toContain(DashboardWidgetKind.AdminLifecycle);
  });

  it('returns no widgets at all to a principal holding nothing', () => {
    expect(kinds(new Set())).toEqual([]);
  });
});
