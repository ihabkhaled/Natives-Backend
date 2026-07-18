import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RECOVERY_ACK_MESSAGE } from '../model/identity.constants';
import { SecurityEventType, UserStatus } from '../model/identity.enums';
import type { User } from '../model/identity.types';
import { RequestPasswordResetUseCase } from './request-password-reset.use-case';

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
  const users = { findActiveByEmail: vi.fn() };
  const resetTokens = { insert: vi.fn() };
  const audit = { record: vi.fn() };

  const useCase = new RequestPasswordResetUseCase(
    unitOfWork as never,
    clock,
    idGenerator,
    secureRandom,
    config as never,
    users as never,
    resetTokens as never,
    audit as never,
  );

  return { useCase, users, resetTokens, audit };
}

describe('RequestPasswordResetUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('mints a reset token and audits for an active account', async () => {
    harness.users.findActiveByEmail.mockResolvedValue(ACTIVE_USER);

    const result = await harness.useCase.execute('Coach@example.test');

    expect(result).toEqual({ message: RECOVERY_ACK_MESSAGE });
    expect(harness.resetTokens.insert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: ACTIVE_USER.id }),
    );
    expect(harness.audit.record).toHaveBeenCalledWith(
      expect.anything(),
      SecurityEventType.PasswordResetRequested,
      ACTIVE_USER.id,
      {},
    );
  });

  it('returns the same ack without minting a token for an unknown account', async () => {
    harness.users.findActiveByEmail.mockResolvedValue(null);

    const result = await harness.useCase.execute('ghost@example.test');

    expect(result).toEqual({ message: RECOVERY_ACK_MESSAGE });
    expect(harness.resetTokens.insert).not.toHaveBeenCalled();
    expect(harness.audit.record).not.toHaveBeenCalled();
  });

  it('returns the same ack without minting a token for a non-active account', async () => {
    harness.users.findActiveByEmail.mockResolvedValue({
      ...ACTIVE_USER,
      status: UserStatus.Suspended,
    });

    const result = await harness.useCase.execute('coach@example.test');

    expect(result).toEqual({ message: RECOVERY_ACK_MESSAGE });
    expect(harness.resetTokens.insert).not.toHaveBeenCalled();
  });
});
