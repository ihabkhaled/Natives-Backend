import { Permission } from '@shared/enums';
import { describe, expect, it } from 'vitest';

import { DashboardWidgetKind } from '../model/dashboard.enums';
import { canSeeWidget } from './widget-visibility.policy';

describe('canSeeWidget', () => {
  it('reveals a widget once the caller holds its permission', () => {
    const permissions = new Set<string>([Permission.PracticeRead]);

    expect(canSeeWidget(DashboardWidgetKind.MemberSchedule, permissions)).toBe(
      true,
    );
  });

  it('hides a widget the caller has no permission for', () => {
    expect(canSeeWidget(DashboardWidgetKind.CoachSessions, new Set())).toBe(
      false,
    );
  });

  it('hides every staff widget from a plain member', () => {
    const member = new Set<string>([
      Permission.TeamRead,
      Permission.PracticeRead,
      Permission.AttendanceReadSelf,
    ]);

    expect(canSeeWidget(DashboardWidgetKind.CoachAttention, member)).toBe(
      false,
    );
    expect(canSeeWidget(DashboardWidgetKind.CoachAssessments, member)).toBe(
      false,
    );
    expect(canSeeWidget(DashboardWidgetKind.AdminLifecycle, member)).toBe(
      false,
    );
  });

  it('reveals the admin lifecycle widget to a lifecycle manager', () => {
    const admin = new Set<string>([Permission.MemberLifecycleManage]);

    expect(canSeeWidget(DashboardWidgetKind.AdminLifecycle, admin)).toBe(true);
  });
});
