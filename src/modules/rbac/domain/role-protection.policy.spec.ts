import { describe, expect, it } from 'vitest';

import type { RbacRoleRecord } from '../model/rbac.types';
import { isProtectedRole } from './role-protection.policy';

function role(overrides: Partial<RbacRoleRecord>): RbacRoleRecord {
  return {
    id: 'role-1',
    key: 'MEMBER',
    scope: 'team',
    isAssignable: true,
    ...overrides,
  };
}

describe('isProtectedRole', () => {
  it('leaves an assignable team role unprotected', () => {
    expect(isProtectedRole(role({}))).toBe(false);
  });

  it('protects a platform-scoped role', () => {
    expect(isProtectedRole(role({ scope: 'platform' }))).toBe(true);
  });

  it('protects an unassignable role even in team scope', () => {
    expect(isProtectedRole(role({ isAssignable: false }))).toBe(true);
  });

  it('protects a role that is both platform-scoped and unassignable', () => {
    expect(
      isProtectedRole(
        role({ key: 'SUPER_ADMIN', scope: 'platform', isAssignable: false }),
      ),
    ).toBe(true);
  });
});
