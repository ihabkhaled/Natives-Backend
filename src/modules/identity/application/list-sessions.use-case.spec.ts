import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RefreshSession } from '../model/identity.types';
import { ListSessionsUseCase } from './list-sessions.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const SESSION: RefreshSession = {
  id: 'session-1',
  userId: 'user-1',
  familyId: 'family-1',
  deviceLabel: 'Firefox on Windows',
  issuedAt: NOW,
  expiresAt: new Date(NOW.getTime() + 60_000),
  rotatedAt: null,
  revokedAt: null,
  reuseDetectedAt: null,
};

function build() {
  const scope = { run: vi.fn() };
  const unitOfWork = {
    runInTransaction: vi.fn(
      async (operation: (value: typeof scope) => Promise<unknown>) =>
        operation(scope),
    ),
  };
  const clock = { now: vi.fn().mockReturnValue(NOW), uptime: vi.fn() };
  const sessions = {
    listActiveForUser: vi.fn().mockResolvedValue({
      items: [SESSION, { ...SESSION, id: 'session-2', deviceLabel: null }],
      total: 2,
    }),
  };
  const useCase = new ListSessionsUseCase(
    unitOfWork as never,
    clock,
    sessions as never,
  );
  return { useCase, sessions };
}

describe('ListSessionsUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('returns a conservative current-aware device projection', async () => {
    const result = await harness.useCase.execute('user-1', 'session-1', {
      limit: 20,
      offset: 0,
    });

    expect(result).toEqual({
      sessions: [
        {
          id: 'session-1',
          device: 'Firefox on Windows',
          approxLocation: '',
          lastActiveAt: NOW,
          current: true,
        },
        {
          id: 'session-2',
          device: 'Unknown device',
          approxLocation: '',
          lastActiveAt: NOW,
          current: false,
        },
      ],
      total: 2,
      limit: 20,
      offset: 0,
    });
    expect(harness.sessions.listActiveForUser).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      NOW,
      { limit: 20, offset: 0 },
    );
  });

  it('supports legacy access tokens by marking no session current', async () => {
    const result = await harness.useCase.execute('user-1', undefined, {
      limit: 20,
      offset: 0,
    });

    expect(result.sessions.every(session => !session.current)).toBe(true);
  });
});
