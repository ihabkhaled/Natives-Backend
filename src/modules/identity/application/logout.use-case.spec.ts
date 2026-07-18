import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LOGOUT_ACK_MESSAGE } from '../model/identity.constants';
import { SecurityEventType } from '../model/identity.enums';
import type { RefreshSession } from '../model/identity.types';
import { LogoutUseCase } from './logout.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');

const SESSION: RefreshSession = {
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
    revokeById: vi.fn(),
  };
  const audit = { record: vi.fn() };

  const useCase = new LogoutUseCase(
    unitOfWork as never,
    clock,
    sessions as never,
    audit as never,
  );

  return { useCase, sessions, audit };
}

describe('LogoutUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('revokes the owned session, audits, and acknowledges', async () => {
    harness.sessions.findByTokenHashForUpdate.mockResolvedValue(SESSION);

    const result = await harness.useCase.execute('user-1', 'rawtoken');

    expect(result).toEqual({ message: LOGOUT_ACK_MESSAGE });
    expect(harness.sessions.revokeById).toHaveBeenCalledWith(
      expect.anything(),
      SESSION.id,
      NOW,
    );
    expect(harness.audit.record).toHaveBeenCalledWith(
      expect.anything(),
      SecurityEventType.SessionRevoked,
      'user-1',
      { sessionId: SESSION.id },
    );
  });

  it('is a silent no-op for an unknown token but still acknowledges', async () => {
    harness.sessions.findByTokenHashForUpdate.mockResolvedValue(null);

    const result = await harness.useCase.execute('user-1', 'rawtoken');

    expect(result).toEqual({ message: LOGOUT_ACK_MESSAGE });
    expect(harness.sessions.revokeById).not.toHaveBeenCalled();
    expect(harness.audit.record).not.toHaveBeenCalled();
  });

  it('does not revoke a session owned by another user', async () => {
    harness.sessions.findByTokenHashForUpdate.mockResolvedValue({
      ...SESSION,
      userId: 'someone-else',
    });

    const result = await harness.useCase.execute('user-1', 'rawtoken');

    expect(result).toEqual({ message: LOGOUT_ACK_MESSAGE });
    expect(harness.sessions.revokeById).not.toHaveBeenCalled();
    expect(harness.audit.record).not.toHaveBeenCalled();
  });
});
