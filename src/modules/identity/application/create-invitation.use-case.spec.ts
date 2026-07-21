import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InvitationConflictError } from '../errors/invitation-conflict.error';
import {
  InvitationStatus,
  SecurityEventType,
  UserStatus,
} from '../model/identity.enums';
import type { Invitation, User } from '../model/identity.types';
import { CreateInvitationUseCase } from './create-invitation.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');

const IDENTITY_CONFIG = {
  refreshTokenTtlSeconds: 1000,
  invitationTtlSeconds: 1000,
  passwordResetTtlSeconds: 1000,
  maxFailedLoginAttempts: 3,
  failedLoginWindowSeconds: 900,
  accountLockoutSeconds: 900,
};

const ACTIVE_USER: User = {
  id: 'user-1',
  email: 'coach@example.test',
  role: 'admin' as User['role'],
  status: UserStatus.Active,
  displayName: 'Coach',
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
  version: 1,
};

const INSERTED_INVITATION: Invitation = {
  id: 'inv-1',
  email: 'coach@example.test',
  invitedBy: 'admin-1',
  role: 'admin' as Invitation['role'],
  status: InvitationStatus.Pending,
  expiresAt: new Date(NOW.getTime() + 1000 * 1000),
  acceptedAt: null,
  revokedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
};

function build() {
  const scope = { run: vi.fn() };
  const unitOfWork = {
    runInTransaction: vi.fn(async (op: (s: typeof scope) => Promise<unknown>) =>
      op(scope),
    ),
  };
  const clock = { now: vi.fn().mockReturnValue(NOW), uptime: vi.fn() };
  const idGenerator = { generate: vi.fn().mockReturnValue('generated-id') };
  const secureRandom = { generateToken: vi.fn().mockReturnValue('rawtoken') };
  const config = { identity: IDENTITY_CONFIG };
  const users = { findActiveByEmail: vi.fn().mockResolvedValue(null) };
  const invitations = {
    findActivePendingByEmail: vi.fn().mockResolvedValue(null),
    insert: vi.fn().mockResolvedValue(INSERTED_INVITATION),
  };
  const audit = { record: vi.fn() };

  const useCase = new CreateInvitationUseCase(
    unitOfWork as never,
    clock,
    idGenerator,
    secureRandom,
    config as never,
    users as never,
    invitations as never,
    audit as never,
  );

  return { useCase, users, invitations, audit };
}

const COMMAND = {
  email: 'Coach@example.test',
  role: 'admin' as User['role'],
  invitedBy: 'admin-1',
};

describe('CreateInvitationUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('inserts an invitation, audits, and returns a delivery with its one-time token', async () => {
    const result = await harness.useCase.execute(COMMAND);

    expect(result).toEqual({
      id: INSERTED_INVITATION.id,
      email: INSERTED_INVITATION.email,
      role: INSERTED_INVITATION.role,
      status: INSERTED_INVITATION.status,
      expiresAt: INSERTED_INVITATION.expiresAt,
      createdAt: INSERTED_INVITATION.createdAt,
      token: 'rawtoken',
    });
    expect(harness.invitations.insert).toHaveBeenCalled();
    expect(harness.audit.record).toHaveBeenCalledWith(
      expect.anything(),
      SecurityEventType.InvitationCreated,
      COMMAND.invitedBy,
      { invitationId: INSERTED_INVITATION.id },
    );
  });

  it('throws a conflict when an active user already exists', async () => {
    harness.users.findActiveByEmail.mockResolvedValue(ACTIVE_USER);

    await expect(harness.useCase.execute(COMMAND)).rejects.toBeInstanceOf(
      InvitationConflictError,
    );
    expect(harness.invitations.insert).not.toHaveBeenCalled();
  });

  it('throws a conflict when a pending invitation already exists', async () => {
    harness.invitations.findActivePendingByEmail.mockResolvedValue(
      INSERTED_INVITATION,
    );

    await expect(harness.useCase.execute(COMMAND)).rejects.toBeInstanceOf(
      InvitationConflictError,
    );
    expect(harness.invitations.insert).not.toHaveBeenCalled();
  });
});
