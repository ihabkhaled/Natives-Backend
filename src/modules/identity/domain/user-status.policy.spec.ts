import { describe, expect, it } from 'vitest';

import { UserStatus } from '../model/identity.enums';
import type { User } from '../model/identity.types';
import { canAuthenticate, canRecoverAccount } from './user-status.policy';

const NOW = new Date('2026-06-01T12:00:00.000Z');

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'coach@example.test',
    role: 'admin' as User['role'],
    status: UserStatus.Active,
    displayName: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    version: 1,
    ...overrides,
  };
}

describe('canAuthenticate', () => {
  it('allows an active, non-deleted user', () => {
    expect(canAuthenticate(makeUser())).toBe(true);
  });

  it('denies a soft-deleted user even when active', () => {
    expect(canAuthenticate(makeUser({ deletedAt: NOW }))).toBe(false);
  });

  it.each([
    UserStatus.Invited,
    UserStatus.Inactive,
    UserStatus.Suspended,
    UserStatus.Left,
  ])('denies a non-active status: %s', status => {
    expect(canAuthenticate(makeUser({ status }))).toBe(false);
  });

  it('denies a soft-deleted user with a non-active status', () => {
    expect(
      canAuthenticate(makeUser({ deletedAt: NOW, status: UserStatus.Left })),
    ).toBe(false);
  });
});

describe('canRecoverAccount', () => {
  it('mirrors canAuthenticate for an active user', () => {
    expect(canRecoverAccount(makeUser())).toBe(true);
  });

  it('denies recovery for a suspended user', () => {
    expect(canRecoverAccount(makeUser({ status: UserStatus.Suspended }))).toBe(
      false,
    );
  });

  it('denies recovery for a soft-deleted user', () => {
    expect(canRecoverAccount(makeUser({ deletedAt: NOW }))).toBe(false);
  });
});
