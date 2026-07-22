import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { RBAC_LAST_SUPER_ADMIN_MESSAGE_KEY } from '../model/rbac.constants';
import { LastSuperAdminError } from './last-super-admin.error';

describe('LastSuperAdminError', () => {
  it('is a 409 with the last-super-admin message key', () => {
    const error = new LastSuperAdminError();

    expect(error.status).toBe(HttpStatus.CONFLICT);
    expect(error.messageKey).toBe(RBAC_LAST_SUPER_ADMIN_MESSAGE_KEY);
  });
});
