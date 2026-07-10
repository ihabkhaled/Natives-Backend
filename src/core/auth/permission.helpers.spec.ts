import { Permission, Role } from '@shared/enums';
import { describe, expect, it } from 'vitest';

import { hasRequiredPermissions } from './permission.helpers';

describe('hasRequiredPermissions', () => {
  it('allows a role that grants every required permission', () => {
    expect(
      hasRequiredPermissions(
        [Role.User],
        [Permission.ArticleCreate, Permission.ArticleRead],
      ),
    ).toBe(true);
  });

  it('denies an identity with no granting role', () => {
    expect(hasRequiredPermissions([], [Permission.ArticleRead])).toBe(false);
  });

  it('allows an empty permission requirement', () => {
    expect(hasRequiredPermissions([], [])).toBe(true);
  });
});
