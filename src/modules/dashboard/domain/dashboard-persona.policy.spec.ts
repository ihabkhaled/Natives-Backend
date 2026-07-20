import { Permission } from '@shared/enums';
import { describe, expect, it } from 'vitest';

import { DashboardPersona } from '../model/dashboard.enums';
import { classifyPersona } from './dashboard-persona.policy';

describe('classifyPersona', () => {
  it('classifies a settings manager as an administrator', () => {
    const permissions = new Set<string>([Permission.TeamSettingsManage]);

    expect(classifyPersona(permissions)).toBe(DashboardPersona.Administrator);
  });

  it('classifies a role manager as an administrator', () => {
    const permissions = new Set<string>([Permission.MemberRolesManage]);

    expect(classifyPersona(permissions)).toBe(DashboardPersona.Administrator);
  });

  it('lets the administration marker win over the coaching marker', () => {
    const permissions = new Set<string>([
      Permission.PracticeManage,
      Permission.TeamSettingsManage,
    ]);

    expect(classifyPersona(permissions)).toBe(DashboardPersona.Administrator);
  });

  it('classifies a practice manager as a coach', () => {
    const permissions = new Set<string>([Permission.PracticeManage]);

    expect(classifyPersona(permissions)).toBe(DashboardPersona.Coach);
  });

  it('classifies an assessment reviewer as a coach', () => {
    const permissions = new Set<string>([Permission.AssessmentReview]);

    expect(classifyPersona(permissions)).toBe(DashboardPersona.Coach);
  });

  it('classifies everyone else as a member', () => {
    expect(classifyPersona(new Set([Permission.TeamRead]))).toBe(
      DashboardPersona.Member,
    );
    expect(classifyPersona(new Set())).toBe(DashboardPersona.Member);
  });
});
