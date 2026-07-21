import { Role } from '@shared/enums';
import { describe, expect, it } from 'vitest';

import {
  AccountState,
  InvitationStatus,
  UserStatus,
} from '../model/identity.enums';
import type { Invitation, IssuedSession, User } from '../model/identity.types';
import {
  buildAuthUserPayload,
  buildLoginResponse,
  toAccountState,
  toAuthUserIdentity,
  toInvitationDelivery,
  toInvitationSummary,
  toPrincipal,
} from './identity.mapper';

const NOW = new Date('2026-06-01T12:00:00.000Z');

const USER: User = {
  id: 'user-1',
  email: 'coach@example.test',
  role: Role.Admin,
  status: UserStatus.Active,
  displayName: 'Coach',
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
  version: 1,
};

const INVITATION: Invitation = {
  id: 'inv-1',
  email: 'invitee@example.test',
  invitedBy: 'admin-1',
  role: Role.User,
  status: InvitationStatus.Pending,
  expiresAt: NOW,
  acceptedAt: null,
  revokedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
};

const SESSION: IssuedSession = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  refreshTokenExpiresAt: NOW,
  userId: USER.id,
};

describe('toAuthUserIdentity', () => {
  it('builds the minimal claim set with the role wrapped as an array', () => {
    expect(toAuthUserIdentity(USER)).toEqual({
      userId: 'user-1',
      email: 'coach@example.test',
      roles: [Role.Admin],
    });
  });

  it('includes the issuing refresh-session id when provided', () => {
    expect(toAuthUserIdentity(USER, 'session-1')).toEqual({
      userId: 'user-1',
      email: 'coach@example.test',
      roles: [Role.Admin],
      sessionId: 'session-1',
    });
  });
});

describe('toPrincipal', () => {
  it('maps a user to its principal projection', () => {
    expect(toPrincipal(USER)).toEqual({
      userId: 'user-1',
      email: 'coach@example.test',
      role: Role.Admin,
      status: UserStatus.Active,
    });
  });
});

describe('toAccountState', () => {
  it.each([
    [UserStatus.Active, AccountState.Active],
    [UserStatus.Invited, AccountState.Pending],
    [UserStatus.Inactive, AccountState.Suspended],
    [UserStatus.Suspended, AccountState.Suspended],
    [UserStatus.Left, AccountState.Suspended],
  ])('maps %s to %s', (status, expected) => {
    expect(toAccountState(status)).toBe(expected);
  });
});

describe('buildLoginResponse', () => {
  it('builds the exact nested login contract', () => {
    expect(
      buildLoginResponse(SESSION, USER, ['practice.read', 'team.read'], []),
    ).toEqual({
      tokens: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      },
      user: {
        id: USER.id,
        email: USER.email,
        displayName: 'Coach',
        permissions: ['practice.read', 'team.read'],
        accountState: AccountState.Active,
        onboardingComplete: true,
        memberships: [],
      },
    });
  });

  it('uses the email when the user has no display name', () => {
    const response = buildLoginResponse(
      SESSION,
      { ...USER, displayName: null },
      [],
      [],
    );

    expect(response.user.displayName).toBe(USER.email);
  });
});

describe('buildAuthUserPayload', () => {
  it('builds the frontend auth-user contract without tokens', () => {
    expect(buildAuthUserPayload(USER, ['practice.read'], [])).toEqual({
      id: USER.id,
      email: USER.email,
      displayName: 'Coach',
      permissions: ['practice.read'],
      accountState: AccountState.Active,
      onboardingComplete: true,
      memberships: [],
    });
  });

  it('uses the email when the user has no display name', () => {
    expect(
      buildAuthUserPayload({ ...USER, displayName: null }, [], []).displayName,
    ).toBe(USER.email);
  });
});

describe('toInvitationSummary', () => {
  it('projects an invitation to its summary, omitting internal fields', () => {
    expect(toInvitationSummary(INVITATION)).toEqual({
      id: 'inv-1',
      email: 'invitee@example.test',
      role: Role.User,
      status: InvitationStatus.Pending,
      expiresAt: NOW,
      createdAt: NOW,
    });
  });
});

describe('toInvitationDelivery', () => {
  it('adds the one-time plaintext token to the summary for manual delivery', () => {
    expect(toInvitationDelivery(INVITATION, 'plaintext-token')).toEqual({
      id: 'inv-1',
      email: 'invitee@example.test',
      role: Role.User,
      status: InvitationStatus.Pending,
      expiresAt: NOW,
      createdAt: NOW,
      token: 'plaintext-token',
    });
  });
});
