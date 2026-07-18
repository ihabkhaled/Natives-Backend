import {
  Permission,
  PERMISSION_AREA_VALUES,
  PERMISSION_VALUES,
} from '@shared/enums';
import { describe, expect, it } from 'vitest';

import {
  PERMISSION_CATALOG,
  PERMISSION_CATALOG_KEYS,
} from './permission-catalog.constants';

// The canonical catalog from 11-SCHEMAS/rbac.permissions.yaml (88 permissions).
const EXPECTED_KEYS: readonly string[] = [
  'team.read',
  'team.settings.read',
  'team.settings.manage',
  'season.manage',
  'venue.manage',
  'member.list',
  'member.profile.read.public',
  'member.profile.read.coach',
  'member.profile.read.admin',
  'member.profile.update.self',
  'member.invite',
  'member.lifecycle.manage',
  'member.roles.manage',
  'member.aliases.manage',
  'practice.read',
  'practice.manage',
  'practice.rsvp.self',
  'practice.rsvp.override',
  'attendance.read.self',
  'attendance.read.team',
  'attendance.record',
  'attendance.finalize',
  'attendance.correct',
  'drill.manage',
  'assessment.read.self.published',
  'assessment.read.team',
  'assessment.create',
  'assessment.review',
  'assessment.publish',
  'assessment.correct',
  'feedback.read.self',
  'feedback.manage',
  'measurement.record',
  'analytics.read.self',
  'analytics.read.team',
  'activity.submit.self',
  'activity.read.self',
  'activity.review',
  'activity.correct',
  'evidence.read.review',
  'points.read.self',
  'points.read.team',
  'points.adjust',
  'leaderboard.read',
  'points.rules.manage',
  'competition.read',
  'competition.manage',
  'squad.read',
  'squad.manage',
  'squad.override_eligibility',
  'roster.read',
  'roster.manage',
  'roster.lock',
  'match.read',
  'match.manage',
  'match.score',
  'match.finalize',
  'match.correct',
  'match.stats.read',
  'match.analysis.read.self',
  'match.analysis.read.team',
  'match.analysis.manage',
  'tryout.public.register',
  'tryout.candidate.read.self',
  'tryout.manage',
  'tryout.contacts.read',
  'tryout.readiness.read',
  'tryout.evaluate',
  'tryout.decide',
  'tryout.convert',
  'governance.read',
  'governance.manage',
  'rules.read',
  'rules.manage',
  'discipline.read',
  'discipline.manage',
  'jersey.read',
  'jersey.manage',
  'notification.read.self',
  'notification.preferences.self',
  'report.generate',
  'report.read',
  'import.manage',
  'import.signoff',
  'audit.read',
  'jobs.manage',
  'data_quality.manage',
  'security.admin',
];

describe('PERMISSION_CATALOG', () => {
  it('covers exactly the canonical catalog from the yaml source', () => {
    expect([...PERMISSION_CATALOG_KEYS].sort()).toEqual(
      [...EXPECTED_KEYS].sort(),
    );
  });

  it('has 88 entries', () => {
    expect(PERMISSION_CATALOG).toHaveLength(88);
  });

  it('has no duplicate keys', () => {
    expect(new Set(PERMISSION_CATALOG_KEYS).size).toBe(
      PERMISSION_CATALOG_KEYS.length,
    );
  });

  it('references only real Permission enum values', () => {
    const permissionValues = new Set<string>(PERMISSION_VALUES);
    for (const key of PERMISSION_CATALOG_KEYS) {
      expect(permissionValues.has(key)).toBe(true);
    }
  });

  it('assigns every entry a known area and non-empty description', () => {
    const areas = new Set<string>(PERMISSION_AREA_VALUES);
    for (const entry of PERMISSION_CATALOG) {
      expect(areas.has(entry.area)).toBe(true);
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });

  it('excludes the template-only article permissions', () => {
    expect(PERMISSION_CATALOG_KEYS).not.toContain(Permission.ArticleRead);
  });
});
