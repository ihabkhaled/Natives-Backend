import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InvalidRefreshTokenError } from '../errors/invalid-refresh-token.error';
import { SecurityEventType, UserStatus } from '../model/identity.enums';
import type {
  IssuedSession,
  RefreshSession,
  User,
} from '../model/identity.types';
import { RefreshSessionUseCase } from './refresh-session.use-case';

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

const ACTIVE_SESSION: RefreshSession = {
  id: 'session-1',
  userId: 'user-1',
  familyId: 'family-1',
  deviceLabel: 'iphone',
  issuedAt: NOW,
  expiresAt: new Date(NOW.getTime() + 60_000),
  rotatedAt: null,
  revokedAt: null,
  reuseDetectedAt: null,
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
  const sessions = {
    findByTokenHashForUpdate: vi.fn(),
    revokeFamilyForReuse: vi.fn(),
    revokeById: vi.fn(),
    markRotated: vi.fn(),
  };
  const users = { findById: vi.fn() };
  const audit = { record: vi.fn() };
  const sessionIssuer = { issue: vi.fn().mockResolvedValue(ISSUED) };

  const useCase = new RefreshSessionUseCase(
    unitOfWork as never,
    clock,
    sessions as never,
    users as never,
    audit as never,
    sessionIssuer as never,
  );

  return { useCase, sessions, users, audit, sessionIssuer };
}

const COMMAND = { refreshToken: 'rawtoken', deviceLabel: 'iphone' };

describe('RefreshSessionUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('rotates the session, audits, and issues in the same family', async () => {
    harness.sessions.findByTokenHashForUpdate.mockResolvedValue(ACTIVE_SESSION);
    harness.users.findById.mockResolvedValue(ACTIVE_USER);

    const result = await harness.useCase.execute(COMMAND);

    expect(result).toEqual(ISSUED);
    expect(harness.sessions.markRotated).toHaveBeenCalledWith(
      expect.anything(),
      ACTIVE_SESSION.id,
      NOW,
    );
    expect(harness.audit.record).toHaveBeenCalledWith(
      expect.anything(),
      SecurityEventType.TokenRefreshed,
      ACTIVE_USER.id,
      { familyId: ACTIVE_SESSION.familyId },
    );
    expect(harness.sessionIssuer.issue).toHaveBeenCalledWith(
      expect.anything(),
      ACTIVE_USER,
      COMMAND.deviceLabel,
      ACTIVE_SESSION.familyId,
    );
  });

  it('throws when the session is unknown', async () => {
    harness.sessions.findByTokenHashForUpdate.mockResolvedValue(null);

    await expect(harness.useCase.execute(COMMAND)).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
    expect(harness.sessionIssuer.issue).not.toHaveBeenCalled();
  });

  it('detects reuse when the session was already rotated', async () => {
    harness.sessions.findByTokenHashForUpdate.mockResolvedValue({
      ...ACTIVE_SESSION,
      rotatedAt: NOW,
    });

    await expect(harness.useCase.execute(COMMAND)).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
    expect(harness.sessions.revokeFamilyForReuse).toHaveBeenCalledWith(
      expect.anything(),
      ACTIVE_SESSION.familyId,
      NOW,
    );
    expect(harness.audit.record).toHaveBeenCalledWith(
      expect.anything(),
      SecurityEventType.RefreshReuseDetected,
      ACTIVE_SESSION.userId,
      { familyId: ACTIVE_SESSION.familyId },
    );
    expect(harness.sessionIssuer.issue).not.toHaveBeenCalled();
  });

  it('detects reuse when the session was already revoked', async () => {
    harness.sessions.findByTokenHashForUpdate.mockResolvedValue({
      ...ACTIVE_SESSION,
      revokedAt: NOW,
    });

    await expect(harness.useCase.execute(COMMAND)).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
    expect(harness.sessions.revokeFamilyForReuse).toHaveBeenCalled();
  });

  it('throws when the session is expired without treating it as reuse', async () => {
    harness.sessions.findByTokenHashForUpdate.mockResolvedValue({
      ...ACTIVE_SESSION,
      expiresAt: new Date(NOW.getTime() - 60_000),
    });

    await expect(harness.useCase.execute(COMMAND)).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
    expect(harness.sessions.revokeFamilyForReuse).not.toHaveBeenCalled();
    expect(harness.sessions.markRotated).not.toHaveBeenCalled();
  });

  it('revokes the session and throws when the user is missing', async () => {
    harness.sessions.findByTokenHashForUpdate.mockResolvedValue(ACTIVE_SESSION);
    harness.users.findById.mockResolvedValue(null);

    await expect(harness.useCase.execute(COMMAND)).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
    expect(harness.sessions.revokeById).toHaveBeenCalledWith(
      expect.anything(),
      ACTIVE_SESSION.id,
      NOW,
    );
    expect(harness.sessionIssuer.issue).not.toHaveBeenCalled();
  });

  it('revokes the session and throws when the user is no longer active', async () => {
    harness.sessions.findByTokenHashForUpdate.mockResolvedValue(ACTIVE_SESSION);
    harness.users.findById.mockResolvedValue({
      ...ACTIVE_USER,
      status: UserStatus.Suspended,
    });

    await expect(harness.useCase.execute(COMMAND)).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
    expect(harness.sessions.revokeById).toHaveBeenCalled();
    expect(harness.sessions.markRotated).not.toHaveBeenCalled();
  });
});
