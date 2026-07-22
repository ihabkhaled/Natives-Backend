import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { RBAC_USER_NOT_ELIGIBLE_MESSAGE_KEY } from '../model/rbac.constants';
import { UserNotEligibleError } from './user-not-eligible.error';

describe('UserNotEligibleError', () => {
  it('is a 409 with the user-not-eligible message key', () => {
    const error = new UserNotEligibleError();

    expect(error.status).toBe(HttpStatus.CONFLICT);
    expect(error.messageKey).toBe(RBAC_USER_NOT_ELIGIBLE_MESSAGE_KEY);
  });
});
