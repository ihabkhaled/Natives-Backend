import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { RBAC_ROLE_NOT_FOUND_MESSAGE_KEY } from '../model/rbac.constants';
import { RoleNotFoundError } from './role-not-found.error';

describe('RoleNotFoundError', () => {
  it('is a 404 with the role-not-found message key', () => {
    const error = new RoleNotFoundError();

    expect(error.status).toBe(HttpStatus.NOT_FOUND);
    expect(error.messageKey).toBe(RBAC_ROLE_NOT_FOUND_MESSAGE_KEY);
  });
});
