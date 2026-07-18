import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LOGOUT_ALL_ACK_MESSAGE } from '../model/identity.constants';
import { SecurityEventType } from '../model/identity.enums';
import { LogoutAllUseCase } from './logout-all.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');

function build() {
  const scope = { run: vi.fn() };
  const unitOfWork = {
    runInTransaction: vi.fn(async (op: (s: typeof scope) => Promise<unknown>) =>
      op(scope),
    ),
  };
  const clock = { now: vi.fn().mockReturnValue(NOW), uptime: vi.fn() };
  const sessions = { revokeAllForUser: vi.fn().mockResolvedValue(3) };
  const audit = { record: vi.fn() };

  const useCase = new LogoutAllUseCase(
    unitOfWork as never,
    clock,
    sessions as never,
    audit as never,
  );

  return { useCase, sessions, audit };
}

describe('LogoutAllUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('revokes all sessions, audits with the count, and acknowledges', async () => {
    const result = await harness.useCase.execute('user-1');

    expect(result).toEqual({ message: LOGOUT_ALL_ACK_MESSAGE });
    expect(harness.sessions.revokeAllForUser).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      NOW,
    );
    expect(harness.audit.record).toHaveBeenCalledWith(
      expect.anything(),
      SecurityEventType.AllSessionsRevoked,
      'user-1',
      { revoked: 3 },
    );
  });
});
