import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ResetTokenInvalidError } from '../errors/reset-token-invalid.error';
import { RESET_ACK_MESSAGE } from '../model/identity.constants';
import { SecurityEventType } from '../model/identity.enums';
import type { PasswordResetToken } from '../model/identity.types';
import { ResetPasswordUseCase } from './reset-password.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');

const USABLE_TOKEN: PasswordResetToken = {
  id: 'reset-1',
  userId: 'user-1',
  expiresAt: new Date(NOW.getTime() + 60_000),
  consumedAt: null,
};

function build() {
  const scope = { run: vi.fn() };
  const unitOfWork = {
    runInTransaction: vi.fn(async (op: (s: typeof scope) => Promise<unknown>) =>
      op(scope),
    ),
  };
  const clock = { now: vi.fn().mockReturnValue(NOW), uptime: vi.fn() };
  const passwordHash = {
    hash: vi.fn().mockResolvedValue('$2b$hash'),
    matches: vi.fn(),
  };
  const resetTokens = {
    findByTokenHashForUpdate: vi.fn(),
    markConsumed: vi.fn(),
  };
  const credentials = { replaceForUser: vi.fn() };
  const sessions = { revokeAllForUser: vi.fn() };
  const audit = { record: vi.fn() };

  const useCase = new ResetPasswordUseCase(
    unitOfWork as never,
    clock,
    passwordHash,
    resetTokens as never,
    credentials as never,
    sessions as never,
    audit as never,
  );

  return { useCase, passwordHash, resetTokens, credentials, sessions, audit };
}

const COMMAND = { token: 'rawtoken', password: 'brand-new-password' };

describe('ResetPasswordUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('consumes the token, replaces the credential, revokes sessions, and audits', async () => {
    harness.resetTokens.findByTokenHashForUpdate.mockResolvedValue(
      USABLE_TOKEN,
    );

    const result = await harness.useCase.execute(COMMAND);

    expect(result).toEqual({ message: RESET_ACK_MESSAGE });
    expect(harness.resetTokens.markConsumed).toHaveBeenCalledWith(
      expect.anything(),
      USABLE_TOKEN.id,
      NOW,
    );
    expect(harness.passwordHash.hash).toHaveBeenCalledWith(COMMAND.password);
    expect(harness.credentials.replaceForUser).toHaveBeenCalledWith(
      expect.anything(),
      USABLE_TOKEN.userId,
      '$2b$hash',
      NOW,
    );
    expect(harness.sessions.revokeAllForUser).toHaveBeenCalledWith(
      expect.anything(),
      USABLE_TOKEN.userId,
      NOW,
    );
    expect(harness.audit.record).toHaveBeenCalledWith(
      expect.anything(),
      SecurityEventType.PasswordResetCompleted,
      USABLE_TOKEN.userId,
      {},
    );
  });

  it('throws when the token is unknown', async () => {
    harness.resetTokens.findByTokenHashForUpdate.mockResolvedValue(null);

    await expect(harness.useCase.execute(COMMAND)).rejects.toBeInstanceOf(
      ResetTokenInvalidError,
    );
    expect(harness.resetTokens.markConsumed).not.toHaveBeenCalled();
    expect(harness.credentials.replaceForUser).not.toHaveBeenCalled();
  });

  it('throws when the token was already consumed', async () => {
    harness.resetTokens.findByTokenHashForUpdate.mockResolvedValue({
      ...USABLE_TOKEN,
      consumedAt: NOW,
    });

    await expect(harness.useCase.execute(COMMAND)).rejects.toBeInstanceOf(
      ResetTokenInvalidError,
    );
    expect(harness.credentials.replaceForUser).not.toHaveBeenCalled();
  });

  it('throws when the token is expired', async () => {
    harness.resetTokens.findByTokenHashForUpdate.mockResolvedValue({
      ...USABLE_TOKEN,
      expiresAt: new Date(NOW.getTime() - 60_000),
    });

    await expect(harness.useCase.execute(COMMAND)).rejects.toBeInstanceOf(
      ResetTokenInvalidError,
    );
    expect(harness.credentials.replaceForUser).not.toHaveBeenCalled();
  });
});
