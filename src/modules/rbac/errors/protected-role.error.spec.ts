import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { RBAC_PROTECTED_ROLE_MESSAGE_KEY } from '../model/rbac.constants';
import { ProtectedRoleError } from './protected-role.error';

describe('ProtectedRoleError', () => {
  it('is a 403 with the protected-role message key', () => {
    const error = new ProtectedRoleError();

    expect(error.status).toBe(HttpStatus.FORBIDDEN);
    expect(error.messageKey).toBe(RBAC_PROTECTED_ROLE_MESSAGE_KEY);
  });
});
