import { Permission, Role } from '@shared/enums';
import { describe, expect, it } from 'vitest';

import {
  bundlePermissionsForRoles,
  hasAllPermissions,
} from './permission.helpers';

describe('bundlePermissionsForRoles', () => {
  it('returns the account-role baseline for the user role', () => {
    const granted = bundlePermissionsForRoles([Role.User]);

    expect(granted.has(Permission.ArticleRead)).toBe(true);
    expect(granted.has(Permission.TeamRead)).toBe(true);
    expect(granted.has(Permission.MemberInvite)).toBe(false);
  });

  it('grants the full catalog to the admin role', () => {
    const granted = bundlePermissionsForRoles([Role.Admin]);

    expect(granted.has(Permission.MemberInvite)).toBe(true);
    expect(granted.has(Permission.SecurityAdmin)).toBe(true);
  });

  it('returns an empty set for no roles', () => {
    expect(bundlePermissionsForRoles([]).size).toBe(0);
  });

  it('ignores an unknown role with no bundle', () => {
    expect(bundlePermissionsForRoles(['ghost' as Role]).size).toBe(0);
  });
});

describe('hasAllPermissions', () => {
  it('is true when every required permission is granted', () => {
    const granted = new Set<string>([
      Permission.ArticleRead,
      Permission.ArticleCreate,
    ]);

    expect(hasAllPermissions(granted, [Permission.ArticleRead])).toBe(true);
  });

  it('is false when a required permission is missing', () => {
    expect(hasAllPermissions(new Set<string>(), [Permission.ArticleRead])).toBe(
      false,
    );
  });

  it('is true for an empty requirement', () => {
    expect(hasAllPermissions(new Set<string>(), [])).toBe(true);
  });
});
