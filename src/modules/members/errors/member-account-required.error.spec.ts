import { ConflictError } from '@core/errors/conflict.error';
import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { MEMBER_ACCOUNT_REQUIRED_MESSAGE_KEY } from '../model/members.constants';
import { MemberAccountRequiredError } from './member-account-required.error';

describe('MemberAccountRequiredError', () => {
  it('carries the safe conflict contract', () => {
    const error = new MemberAccountRequiredError();

    expect(error).toBeInstanceOf(ConflictError);
    expect(error.status).toBe(HttpStatus.CONFLICT);
    expect(error.messageKey).toBe(MEMBER_ACCOUNT_REQUIRED_MESSAGE_KEY);
  });
});
