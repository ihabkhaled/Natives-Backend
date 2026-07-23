import { Permission, RBAC_ROLE_VALUES, RbacRole } from '@shared/enums';
import { describe, expect, it } from 'vitest';

import { PERMISSION_CATALOG_KEYS } from './permission-catalog.constants';
import { ROLE_BUNDLE_METADATA, ROLE_BUNDLES } from './role-bundles.constants';

function bundle(role: RbacRole): ReadonlySet<string> {
  return new Set<string>(ROLE_BUNDLES.get(role) ?? []);
}

function sortedBundle(role: RbacRole): readonly string[] {
  return [...bundle(role)].sort();
}

/**
 * The exact pinned permission set of every default bundle. A grant added or
 * removed from a bundle MUST update this pin in the same change — the pin is
 * the regression contract the P4 frontend waves build their persona matrices
 * against (member/coach hold rules.read + jersey.read; team admin additionally
 * holds governance.read; analyst deliberately holds no governance/jersey grant).
 */
const PINNED_MEMBER_BUNDLE: readonly string[] = [
  'activity.read.self',
  'activity.submit.self',
  'analytics.read.self',
  'assessment.read.self.published',
  'attendance.read.self',
  'competition.read',
  'feedback.read.self',
  'jersey.read',
  'leaderboard.read',
  'match.analysis.read.self',
  'match.read',
  'match.stats.read',
  'member.profile.read.public',
  'member.profile.update.self',
  'notification.preferences.self',
  'notification.read.self',
  'points.read.self',
  'practice.read',
  'practice.rsvp.self',
  'roster.read',
  'rules.read',
  'squad.read',
  'team.read',
];

const PINNED_COACH_EXTENSION: readonly string[] = [
  'activity.review',
  'analytics.read.team',
  'assessment.create',
  'assessment.publish',
  'assessment.read.team',
  'assessment.review',
  'attendance.finalize',
  'attendance.read.team',
  'attendance.record',
  'competition.manage',
  'drill.manage',
  'evidence.read.review',
  'feedback.manage',
  'match.analysis.manage',
  'match.analysis.read.team',
  'match.manage',
  'measurement.record',
  'member.list',
  'member.profile.read.coach',
  'points.read.team',
  'practice.manage',
  'practice.rsvp.override',
  'roster.manage',
  'squad.manage',
  'tryout.evaluate',
  'tryout.manage',
];

const PINNED_TEAM_ADMIN_EXTENSION: readonly string[] = [
  'activity.correct',
  'assessment.correct',
  'attendance.correct',
  'audit.read',
  'data_quality.manage',
  'discipline.manage',
  'discipline.read',
  'governance.manage',
  'governance.read',
  'import.manage',
  'import.signoff',
  'jersey.manage',
  'jobs.manage',
  'match.correct',
  'match.finalize',
  'match.score',
  'member.aliases.manage',
  'member.invite',
  'member.lifecycle.manage',
  'member.roles.manage',
  'points.adjust',
  'points.rules.manage',
  'report.generate',
  'report.read',
  'roster.lock',
  'rules.manage',
  'season.manage',
  'squad.override_eligibility',
  'team.settings.manage',
  'team.settings.read',
  'tryout.contacts.read',
  'tryout.convert',
  'tryout.decide',
  'tryout.readiness.read',
  'venue.manage',
];

const PINNED_SCOREKEEPER_BUNDLE: readonly string[] = [
  'competition.read',
  'match.read',
  'match.score',
  'match.stats.read',
  'roster.read',
  'team.read',
];

const PINNED_ANALYST_BUNDLE: readonly string[] = [
  'analytics.read.team',
  'attendance.read.team',
  'competition.read',
  'leaderboard.read',
  'match.read',
  'match.stats.read',
  'member.list',
  'points.read.team',
  'practice.read',
  'report.generate',
  'report.read',
  'roster.read',
  'team.read',
];

describe('ROLE_BUNDLES', () => {
  it('defines all six default bundles with metadata', () => {
    expect(ROLE_BUNDLES.size).toBe(6);
    for (const role of RBAC_ROLE_VALUES) {
      expect(ROLE_BUNDLES.has(role)).toBe(true);
      expect(ROLE_BUNDLE_METADATA.has(role)).toBe(true);
    }
  });

  it('grants SUPER_ADMIN the entire catalog including the platform scope', () => {
    const superAdmin = bundle(RbacRole.SuperAdmin);

    expect(superAdmin.size).toBe(PERMISSION_CATALOG_KEYS.length);
    expect(superAdmin.has(Permission.PlatformAdmin)).toBe(true);
    expect(superAdmin.has(Permission.TeamCreate)).toBe(true);
    expect(superAdmin.has(Permission.TeamBrowseAll)).toBe(true);
  });

  it('withholds every platform permission from the team-scoped bundles', () => {
    const platformScoped: readonly Permission[] = [
      Permission.PlatformAdmin,
      Permission.TeamCreate,
      Permission.TeamBrowseAll,
    ];
    const teamScoped: readonly RbacRole[] = [
      RbacRole.Member,
      RbacRole.Coach,
      RbacRole.TeamAdmin,
      RbacRole.Scorekeeper,
      RbacRole.Analyst,
    ];

    for (const role of teamScoped) {
      for (const permission of platformScoped) {
        expect(bundle(role).has(permission)).toBe(false);
      }
    }
  });

  it('composes COACH as a superset of MEMBER', () => {
    const member = bundle(RbacRole.Member);
    const coach = bundle(RbacRole.Coach);

    for (const permission of member) {
      expect(coach.has(permission)).toBe(true);
    }
    expect(coach.size).toBeGreaterThan(member.size);
  });

  it('composes TEAM_ADMIN as a superset of COACH', () => {
    const coach = bundle(RbacRole.Coach);
    const teamAdmin = bundle(RbacRole.TeamAdmin);

    for (const permission of coach) {
      expect(teamAdmin.has(permission)).toBe(true);
    }
    expect(teamAdmin.has(Permission.MemberRolesManage)).toBe(true);
  });

  it('only bundles canonical catalog permissions', () => {
    const catalog = new Set<string>(PERMISSION_CATALOG_KEYS);
    for (const role of RBAC_ROLE_VALUES) {
      for (const permission of ROLE_BUNDLES.get(role) ?? []) {
        expect(catalog.has(permission)).toBe(true);
      }
    }
  });

  it('grants the scorekeeper match scoring and the analyst reporting', () => {
    expect(bundle(RbacRole.Scorekeeper).has(Permission.MatchScore)).toBe(true);
    expect(bundle(RbacRole.Analyst).has(Permission.ReportRead)).toBe(true);
    expect(bundle(RbacRole.Member).has(Permission.MemberInvite)).toBe(false);
  });

  it('pins the exact MEMBER bundle including the P4 governed read grants', () => {
    expect(sortedBundle(RbacRole.Member)).toEqual(PINNED_MEMBER_BUNDLE);
    expect(bundle(RbacRole.Member).has(Permission.RulesRead)).toBe(true);
    expect(bundle(RbacRole.Member).has(Permission.JerseyRead)).toBe(true);
    expect(bundle(RbacRole.Member).has(Permission.GovernanceRead)).toBe(false);
  });

  it('pins the exact COACH bundle as MEMBER plus the coaching extension', () => {
    expect(sortedBundle(RbacRole.Coach)).toEqual(
      [...PINNED_MEMBER_BUNDLE, ...PINNED_COACH_EXTENSION].sort(),
    );
  });

  it('pins the exact TEAM_ADMIN bundle as COACH plus the admin extension', () => {
    expect(sortedBundle(RbacRole.TeamAdmin)).toEqual(
      [
        ...PINNED_MEMBER_BUNDLE,
        ...PINNED_COACH_EXTENSION,
        ...PINNED_TEAM_ADMIN_EXTENSION,
      ].sort(),
    );
    expect(bundle(RbacRole.TeamAdmin).has(Permission.GovernanceRead)).toBe(
      true,
    );
  });

  it('pins the exact SCOREKEEPER and ANALYST bundles', () => {
    expect(sortedBundle(RbacRole.Scorekeeper)).toEqual(
      PINNED_SCOREKEEPER_BUNDLE,
    );
    expect(sortedBundle(RbacRole.Analyst)).toEqual(PINNED_ANALYST_BUNDLE);
    // Deliberate least-privilege decision (P4 BE-1): the analyst bundle stays
    // without governance/jersey grants — the persona matrix marks governance
    // read for analysts as optional, not default.
    expect(bundle(RbacRole.Analyst).has(Permission.GovernanceRead)).toBe(false);
    expect(bundle(RbacRole.Analyst).has(Permission.JerseyRead)).toBe(false);
  });

  it('composes TEAM_ADMIN as a superset of SCOREKEEPER and ANALYST', () => {
    // The privilege ceiling only lets an actor assign bundles fully contained
    // in their own permissions; a team administrator must be able to assign
    // every team-scoped bundle, including SCOREKEEPER (match.score).
    const teamAdmin = bundle(RbacRole.TeamAdmin);

    for (const permission of bundle(RbacRole.Scorekeeper)) {
      expect(teamAdmin.has(permission)).toBe(true);
    }
    for (const permission of bundle(RbacRole.Analyst)) {
      expect(teamAdmin.has(permission)).toBe(true);
    }
  });
});
