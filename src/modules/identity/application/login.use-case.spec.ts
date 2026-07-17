import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InvalidCredentialsError } from '../errors/invalid-credentials.error';
import { SecurityEventType, UserStatus } from '../model/identity.enums';
import type { IssuedSession, User } from '../model/identity.types';
import { LoginUseCase } from './login.use-case';

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
  const passwordHash = { hash: vi.fn(), matches: vi.fn() };
  const config = { identity: IDENTITY_CONFIG };
  const users = {
    findWithCredentialByEmail: vi.fn(),
    findById: vi.fn(),
    findActiveByEmail: vi.fn(),
    insert: vi.fn(),
  };
  const failedLogins = {
    findByEmailForUpdate: vi.fn().mockResolvedValue(null),
    insert: vi.fn(),
    update: vi.fn(),
    clearByEmail: vi.fn(),
  };
  const audit = { record: vi.fn() };
  const sessionIssuer = { issue: vi.fn().mockResolvedValue(ISSUED) };

  const useCase = new LoginUseCase(
    unitOfWork as never,
    clock,
    idGenerator,
    passwordHash,
    config as never,
    users as never,
    failedLogins,
    audit as never,
    sessionIssuer as never,
  );

  return {
    useCase,
    clock,
    passwordHash,
    users,
    failedLogins,
    audit,
    sessionIssuer,
  };
}

describe('LoginUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('issues a session, clears failures, and audits on success', async () => {
    harness.users.findWithCredentialByEmail.mockResolvedValue({
      user: ACTIVE_USER,
      passwordHash: '$2b$10$hash',
    });
    harness.passwordHash.matches.mockResolvedValue(true);

    const result = await harness.useCase.execute({
      email: 'Coach@example.test',
      password: 'correct-horse-battery',
      deviceLabel: 'iphone',
    });

    expect(result).toEqual(ISSUED);
    expect(harness.failedLogins.clearByEmail).toHaveBeenCalledWith(
      expect.anything(),
      'coach@example.test',
    );
    expect(harness.audit.record).toHaveBeenCalledWith(
      expect.anything(),
      SecurityEventType.LoginSucceeded,
      'user-1',
      {},
    );
    expect(harness.sessionIssuer.issue).toHaveBeenCalled();
  });

  it('rejects an unknown account generically after comparing a dummy hash', async () => {
    harness.users.findWithCredentialByEmail.mockResolvedValue(null);
    harness.passwordHash.matches.mockResolvedValue(false);

    await expect(
      harness.useCase.execute({
        email: 'ghost@example.test',
        password: 'whatever-password',
        deviceLabel: null,
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(harness.passwordHash.matches).toHaveBeenCalled();
    expect(harness.failedLogins.insert).toHaveBeenCalled();
    expect(harness.audit.record).toHaveBeenCalledWith(
      expect.anything(),
      SecurityEventType.LoginFailed,
      null,
      { attempt: 1 },
    );
  });

  it('rejects a wrong password generically', async () => {
    harness.users.findWithCredentialByEmail.mockResolvedValue({
      user: ACTIVE_USER,
      passwordHash: '$2b$10$hash',
    });
    harness.passwordHash.matches.mockResolvedValue(false);

    await expect(
      harness.useCase.execute({
        email: 'coach@example.test',
        password: 'wrong-password-value',
        deviceLabel: null,
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('denies a non-active user even with a correct password', async () => {
    harness.users.findWithCredentialByEmail.mockResolvedValue({
      user: { ...ACTIVE_USER, status: UserStatus.Suspended },
      passwordHash: '$2b$10$hash',
    });
    harness.passwordHash.matches.mockResolvedValue(true);

    await expect(
      harness.useCase.execute({
        email: 'coach@example.test',
        password: 'correct-horse-battery',
        deviceLabel: null,
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(harness.sessionIssuer.issue).not.toHaveBeenCalled();
  });

  it('denies immediately when the identity is locked out', async () => {
    harness.failedLogins.findByEmailForUpdate.mockResolvedValue({
      id: 'state-1',
      email: 'coach@example.test',
      attemptCount: 3,
      firstAttemptAt: NOW,
      lockedUntil: new Date(NOW.getTime() + 60_000),
    });

    await expect(
      harness.useCase.execute({
        email: 'coach@example.test',
        password: 'correct-horse-battery',
        deviceLabel: null,
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(harness.users.findWithCredentialByEmail).not.toHaveBeenCalled();
  });

  it('locks the account when repeated failures reach the ceiling', async () => {
    harness.failedLogins.findByEmailForUpdate.mockResolvedValue({
      id: 'state-1',
      email: 'coach@example.test',
      attemptCount: 2,
      firstAttemptAt: NOW,
      lockedUntil: null,
    });
    harness.users.findWithCredentialByEmail.mockResolvedValue(null);
    harness.passwordHash.matches.mockResolvedValue(false);

    await expect(
      harness.useCase.execute({
        email: 'coach@example.test',
        password: 'wrong-password-value',
        deviceLabel: null,
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(harness.failedLogins.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        attemptCount: 3,
        lockedUntil: expect.any(Date),
      }),
    );
    expect(harness.audit.record).toHaveBeenCalledWith(
      expect.anything(),
      SecurityEventType.AccountLocked,
      null,
      { attempt: 3 },
    );
  });

  it('resets the counter after the failure window elapses', async () => {
    harness.failedLogins.findByEmailForUpdate.mockResolvedValue({
      id: 'state-1',
      email: 'coach@example.test',
      attemptCount: 2,
      firstAttemptAt: new Date(NOW.getTime() - 3_600_000),
      lockedUntil: null,
    });
    harness.users.findWithCredentialByEmail.mockResolvedValue(null);
    harness.passwordHash.matches.mockResolvedValue(false);

    await expect(
      harness.useCase.execute({
        email: 'coach@example.test',
        password: 'wrong-password-value',
        deviceLabel: null,
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(harness.failedLogins.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ attemptCount: 1, lockedUntil: null }),
    );
  });
});
