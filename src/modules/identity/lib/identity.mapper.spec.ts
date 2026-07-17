import { Role } from '@shared/enums';
import { describe, expect, it } from 'vitest';

import { InvitationStatus, UserStatus } from '../model/identity.enums';
import type { Invitation, User } from '../model/identity.types';
import {
  toAuthUserIdentity,
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

describe('toAuthUserIdentity', () => {
  it('builds the minimal claim set with the role wrapped as an array', () => {
    expect(toAuthUserIdentity(USER)).toEqual({
      userId: 'user-1',
      email: 'coach@example.test',
      roles: [Role.Admin],
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
