import { describe, expect, it } from 'vitest';

import { UserStatus } from '../model/identity.enums';
import type { User } from '../model/identity.types';
import { isReviewableSignup } from './signup.policy';

const NOW = new Date('2026-06-01T12:00:00.000Z');

function makeUser(overrides: Partial<User>): User {
  return {
    id: 'user-1',
    email: 'applicant@example.test',
    role: 'user' as User['role'],
    status: UserStatus.Pending,
    displayName: 'Applicant',
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    version: 1,
    ...overrides,
  };
}

describe('isReviewableSignup', () => {
  it('accepts a pending, non-deleted account', () => {
    expect(isReviewableSignup(makeUser({}))).toBe(true);
  });

  it.each([
    UserStatus.Active,
    UserStatus.Rejected,
    UserStatus.Invited,
    UserStatus.Suspended,
  ])('rejects an account already in %s', status => {
    expect(isReviewableSignup(makeUser({ status }))).toBe(false);
  });

  it('rejects a soft-deleted pending account', () => {
    expect(isReviewableSignup(makeUser({ deletedAt: NOW }))).toBe(false);
  });
});
