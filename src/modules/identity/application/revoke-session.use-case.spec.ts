import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionNotFoundError } from '../errors/session-not-found.error';
import { LOGOUT_ACK_MESSAGE } from '../model/identity.constants';
import { SecurityEventType } from '../model/identity.enums';
import { RevokeSessionUseCase } from './revoke-session.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');

function build() {
  const scope = { run: vi.fn() };
  const unitOfWork = {
    runInTransaction: vi.fn(
      async (operation: (value: typeof scope) => Promise<unknown>) =>
        operation(scope),
    ),
  };
  const clock = { now: vi.fn().mockReturnValue(NOW), uptime: vi.fn() };
  const sessions = { revokeOwnedById: vi.fn().mockResolvedValue(true) };
  const audit = { record: vi.fn() };
  const useCase = new RevokeSessionUseCase(
    unitOfWork as never,
    clock,
    sessions as never,
    audit as never,
  );
  return { useCase, sessions, audit };
}

describe('RevokeSessionUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('revokes and audits one owned session', async () => {
    await expect(
      harness.useCase.execute('user-1', 'session-1'),
    ).resolves.toEqual({ message: LOGOUT_ACK_MESSAGE });
    expect(harness.sessions.revokeOwnedById).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      'session-1',
      NOW,
    );
    expect(harness.audit.record).toHaveBeenCalledWith(
      expect.anything(),
      SecurityEventType.SessionRevoked,
      'user-1',
      { sessionId: 'session-1' },
    );
  });

  it('returns the same not-found error for missing or foreign sessions', async () => {
    harness.sessions.revokeOwnedById.mockResolvedValue(false);

    await expect(
      harness.useCase.execute('user-1', 'foreign-session'),
    ).rejects.toBeInstanceOf(SessionNotFoundError);
    expect(harness.audit.record).not.toHaveBeenCalled();
  });
});
