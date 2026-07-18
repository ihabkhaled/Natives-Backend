import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionContextRequiredError } from '../errors/session-context-required.error';
import { SecurityEventType } from '../model/identity.enums';
import { RevokeOtherSessionsUseCase } from './revoke-other-sessions.use-case';

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
  const sessions = { revokeOthersForUser: vi.fn().mockResolvedValue(2) };
  const audit = { record: vi.fn() };
  const useCase = new RevokeOtherSessionsUseCase(
    unitOfWork as never,
    clock,
    sessions as never,
    audit as never,
  );
  return { useCase, sessions, audit };
}

describe('RevokeOtherSessionsUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('preserves the current session and returns the revoked count', async () => {
    await expect(
      harness.useCase.execute('user-1', 'session-1'),
    ).resolves.toEqual({ revokedCount: 2 });
    expect(harness.sessions.revokeOthersForUser).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      'session-1',
      NOW,
    );
    expect(harness.audit.record).toHaveBeenCalledWith(
      expect.anything(),
      SecurityEventType.OtherSessionsRevoked,
      'user-1',
      { currentSessionId: 'session-1', revoked: 2 },
    );
  });

  it('rejects a legacy token without revoking every session', async () => {
    await expect(
      harness.useCase.execute('user-1', undefined),
    ).rejects.toBeInstanceOf(SessionContextRequiredError);
    expect(harness.sessions.revokeOthersForUser).not.toHaveBeenCalled();
    expect(harness.audit.record).not.toHaveBeenCalled();
  });
});
