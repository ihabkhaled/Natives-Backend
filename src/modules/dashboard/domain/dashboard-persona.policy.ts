import { Permission } from '@shared/enums';

import { DashboardPersona } from '../model/dashboard.enums';

/**
 * Classify the caller's dashboard persona from their real effective permissions
 * in the requested scope — never from an account role column. Administration
 * markers win over coaching markers, and everyone else is a member. Pure and
 * total: every permission set maps to exactly one persona.
 */
export function classifyPersona(
  permissions: ReadonlySet<string>,
): DashboardPersona {
  if (
    permissions.has(Permission.TeamSettingsManage) ||
    permissions.has(Permission.MemberRolesManage)
  ) {
    return DashboardPersona.Administrator;
  }
  if (
    permissions.has(Permission.PracticeManage) ||
    permissions.has(Permission.AssessmentReview)
  ) {
    return DashboardPersona.Coach;
  }
  return DashboardPersona.Member;
}
