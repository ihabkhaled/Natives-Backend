import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ExpireInvitationsUseCase } from './expire-invitations.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');

function build() {
  const scope = { run: vi.fn() };
  const unitOfWork = {
    runInTransaction: vi.fn(async (op: (s: typeof scope) => Promise<unknown>) =>
      op(scope),
    ),
  };
  const clock = { now: vi.fn().mockReturnValue(NOW), uptime: vi.fn() };
  const invitations = { expireOverdue: vi.fn().mockResolvedValue(4) };

  const useCase = new ExpireInvitationsUseCase(
    unitOfWork as never,
    clock,
    invitations as never,
  );

  return { useCase, invitations };
}

describe('ExpireInvitationsUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('returns the count of expired invitations from the repository', async () => {
    const result = await harness.useCase.execute();

    expect(result).toBe(4);
    expect(harness.invitations.expireOverdue).toHaveBeenCalledWith(
      expect.anything(),
      NOW,
    );
  });

  it('returns zero when nothing was overdue', async () => {
    harness.invitations.expireOverdue.mockResolvedValue(0);

    const result = await harness.useCase.execute();

    expect(result).toBe(0);
  });
});
