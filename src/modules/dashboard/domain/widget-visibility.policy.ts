import { Permission } from '@shared/enums';

import { DashboardWidgetKind } from '../model/dashboard.enums';

/**
 * The permission each widget requires before it may appear in a summary. A
 * widget with no entry is visible to any authenticated member of the team.
 * Declared as data so the authorization surface of the dashboard is readable in
 * one place instead of hiding inside the builders.
 */
const REQUIRED_PERMISSION: ReadonlyMap<DashboardWidgetKind, Permission> =
  new Map([
    [DashboardWidgetKind.MemberSchedule, Permission.PracticeRead],
    [DashboardWidgetKind.MemberAttendance, Permission.AttendanceReadSelf],
    [DashboardWidgetKind.MemberStanding, Permission.LeaderboardRead],
    [DashboardWidgetKind.MemberActivity, Permission.PointsReadSelf],
    [
      DashboardWidgetKind.MemberFeedback,
      Permission.AssessmentReadSelfPublished,
    ],
    [DashboardWidgetKind.MemberProfile, Permission.MemberProfileUpdateSelf],
    [DashboardWidgetKind.CoachSessions, Permission.PracticeManage],
    [DashboardWidgetKind.CoachAttention, Permission.AttendanceFinalize],
    [DashboardWidgetKind.CoachAssessments, Permission.AssessmentReview],
    [DashboardWidgetKind.CoachRoster, Permission.MemberList],
    [DashboardWidgetKind.AdminLifecycle, Permission.MemberLifecycleManage],
  ]);

/**
 * True when the caller's effective permissions reveal this widget. Pure: the
 * same permission set always yields the same answer, and an unmapped widget is
 * always visible.
 */
export function canSeeWidget(
  kind: DashboardWidgetKind,
  permissions: ReadonlySet<string>,
): boolean {
  const required = REQUIRED_PERMISSION.get(kind);
  return required === undefined || permissions.has(required);
}
