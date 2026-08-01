import { describe, expect, it, vi } from 'vitest';

import { AccountState, UserStatus } from '../model/identity.enums';
import type { User } from '../model/identity.types';
import { ListPendingSignupsUseCase } from './list-pending-signups.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');

const PENDING_USER: User = {
  id: 'user-1',
  email: 'applicant@example.test',
  role: 'user' as User['role'],
  status: UserStatus.Pending,
  displayName: 'Sam',
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
  version: 1,
};

function build(pending: readonly User[]) {
  const scope = { run: vi.fn() };
  const unitOfWork = {
    runInTransaction: vi.fn(async (op: (s: typeof scope) => Promise<unknown>) =>
      op(scope),
    ),
  };
  const users = { listByStatus: vi.fn().mockResolvedValue(pending) };
  const useCase = new ListPendingSignupsUseCase(
    unitOfWork as never,
    users as never,
  );
  return { useCase, users };
}

describe('ListPendingSignupsUseCase', () => {
  it('queries only pending accounts and projects credential-free summaries', async () => {
    const harness = build([PENDING_USER]);

    const result = await harness.useCase.execute();

    expect(harness.users.listByStatus).toHaveBeenCalledWith(
      expect.anything(),
      UserStatus.Pending,
    );
    expect(result).toEqual({
      items: [
        {
          id: 'user-1',
          email: 'applicant@example.test',
          displayName: 'Sam',
          state: AccountState.Pending,
          requestedAt: NOW,
        },
      ],
    });
  });

  it('returns an empty queue when nothing is pending', async () => {
    const harness = build([]);
    expect(await harness.useCase.execute()).toEqual({ items: [] });
  });
});
