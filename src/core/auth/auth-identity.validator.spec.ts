import { Role } from '@shared/enums';
import { describe, expect, it } from 'vitest';

import { isAuthUserIdentity } from './auth-identity.validator';

describe('isAuthUserIdentity', () => {
  it('accepts a complete identity with known roles', () => {
    expect(
      isAuthUserIdentity({
        userId: 'user-1',
        email: 'user@example.com',
        roles: [Role.User],
      }),
    ).toBe(true);
  });

  it('accepts a session-aware identity', () => {
    expect(
      isAuthUserIdentity({
        userId: 'user-1',
        email: 'user@example.com',
        roles: [Role.User],
        sessionId: 'session-1',
      }),
    ).toBe(true);
  });

  it.each([
    null,
    {},
    { userId: 1, email: 'user@example.com', roles: [Role.User] },
    { userId: '   ', email: 'user@example.com', roles: [Role.User] },
    { userId: 'user-1', email: 1, roles: [Role.User] },
    { userId: 'user-1', email: 'invalid-email', roles: [Role.User] },
    { userId: 'user-1', email: 'user@example.com', roles: 'user' },
    { userId: 'user-1', email: 'user@example.com', roles: ['unknown'] },
    {
      userId: 'user-1',
      email: 'user@example.com',
      roles: [Role.User],
      sessionId: 1,
    },
    {
      userId: 'user-1',
      email: 'user@example.com',
      roles: [Role.User],
      sessionId: '   ',
    },
  ])('rejects malformed identity %#', value => {
    expect(isAuthUserIdentity(value)).toBe(false);
  });
});
