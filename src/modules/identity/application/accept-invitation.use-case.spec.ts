import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InvitationInvalidError } from '../errors/invitation-invalid.error';
import {
  InvitationStatus,
  SecurityEventType,
  UserStatus,
} from '../model/identity.enums';
import type { Invitation, IssuedSession, User } from '../model/identity.types';
import { AcceptInvitationUseCase } from './accept-invitation.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');

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

const PENDING_INVITATION: Invitation = {
  id: 'inv-1',
  email: 'coach@example.test',
  invitedBy: 'admin-1',
  role: 'admin' as Invitation['role'],
  status: InvitationStatus.Pending,
  expiresAt: new Date(NOW.getTime() + 60_000),
  acceptedAt: null,
  revokedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
};

const ISSUED: IssuedSession = {
  accessToken: 'access',
  refreshToken: 'refresh',
  refreshTokenExpiresAt: NOW,
  userId: 'user-1',
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
  const passwordHash = {
    hash: vi.fn().mockResolvedValue('$2b$hash'),
    matches: vi.fn(),
  };
  const users = { insert: vi.fn().mockResolvedValue(ACTIVE_USER) };
  const credentials = { insert: vi.fn() };
  const invitations = {
    findByTokenHashForUpdate: vi.fn(),
    markAccepted: vi.fn(),
  };
  const audit = { record: vi.fn() };
  const sessionIssuer = { issue: vi.fn().mockResolvedValue(ISSUED) };

  const useCase = new AcceptInvitationUseCase(
    unitOfWork as never,
    clock,
    idGenerator,
    passwordHash,
    users as never,
    credentials as never,
    invitations as never,
    audit as never,
    sessionIssuer as never,
  );

  return {
    useCase,
    passwordHash,
    users,
    credentials,
    invitations,
    audit,
    sessionIssuer,
  };
}

const COMMAND = {
  token: 'rawtoken',
  password: 'correct-horse-battery',
  displayName: 'Coach',
  deviceLabel: 'iphone',
};

describe('AcceptInvitationUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('creates the account, marks accepted, audits, and issues a session', async () => {
    harness.invitations.findByTokenHashForUpdate.mockResolvedValue(
      PENDING_INVITATION,
    );

    const result = await harness.useCase.execute(COMMAND);

    expect(result).toEqual(ISSUED);
    expect(harness.users.insert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        email: PENDING_INVITATION.email,
        role: PENDING_INVITATION.role,
        status: UserStatus.Active,
        displayName: 'Coach',
      }),
    );
    expect(harness.passwordHash.hash).toHaveBeenCalledWith(COMMAND.password);
    expect(harness.credentials.insert).toHaveBeenCalled();
    expect(harness.invitations.markAccepted).toHaveBeenCalledWith(
      expect.anything(),
      PENDING_INVITATION.id,
      NOW,
    );
    expect(harness.audit.record).toHaveBeenCalledWith(
      expect.anything(),
      SecurityEventType.InvitationAccepted,
      ACTIVE_USER.id,
      { invitationId: PENDING_INVITATION.id },
    );
    expect(harness.sessionIssuer.issue).toHaveBeenCalled();
  });

  it('throws when the token is unknown and never inserts a user', async () => {
    harness.invitations.findByTokenHashForUpdate.mockResolvedValue(null);

    await expect(harness.useCase.execute(COMMAND)).rejects.toBeInstanceOf(
      InvitationInvalidError,
    );
    expect(harness.users.insert).not.toHaveBeenCalled();
    expect(harness.sessionIssuer.issue).not.toHaveBeenCalled();
  });

  it('throws when the invitation is expired and never inserts a user', async () => {
    harness.invitations.findByTokenHashForUpdate.mockResolvedValue({
      ...PENDING_INVITATION,
      expiresAt: new Date(NOW.getTime() - 60_000),
    });

    await expect(harness.useCase.execute(COMMAND)).rejects.toBeInstanceOf(
      InvitationInvalidError,
    );
    expect(harness.users.insert).not.toHaveBeenCalled();
  });

  it('throws when the invitation was already revoked', async () => {
    harness.invitations.findByTokenHashForUpdate.mockResolvedValue({
      ...PENDING_INVITATION,
      revokedAt: NOW,
    });

    await expect(harness.useCase.execute(COMMAND)).rejects.toBeInstanceOf(
      InvitationInvalidError,
    );
    expect(harness.users.insert).not.toHaveBeenCalled();
  });

  it('throws when the invitation was already accepted', async () => {
    harness.invitations.findByTokenHashForUpdate.mockResolvedValue({
      ...PENDING_INVITATION,
      status: InvitationStatus.Accepted,
      acceptedAt: NOW,
    });

    await expect(harness.useCase.execute(COMMAND)).rejects.toBeInstanceOf(
      InvitationInvalidError,
    );
    expect(harness.users.insert).not.toHaveBeenCalled();
  });
});
