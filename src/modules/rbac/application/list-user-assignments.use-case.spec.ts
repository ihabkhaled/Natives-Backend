import { describe, expect, it, vi } from 'vitest';

import { ListUserAssignmentsUseCase } from './list-user-assignments.use-case';

describe('ListUserAssignmentsUseCase', () => {
  it('returns the user id with its active assignments', async () => {
    const scopeStub = {};
    const unitOfWork = {
      runInTransaction: vi.fn(
        async (op: (s: typeof scopeStub) => Promise<unknown>) => op(scopeStub),
      ),
    };
    const repository = {
      listActiveAssignmentsForUser: vi.fn().mockResolvedValue([{ id: 'a1' }]),
    };
    const useCase = new ListUserAssignmentsUseCase(
      unitOfWork as never,
      repository as never,
    );

    const result = await useCase.execute('user-1');

    expect(result).toEqual({ userId: 'user-1', assignments: [{ id: 'a1' }] });
    expect(repository.listActiveAssignmentsForUser).toHaveBeenCalledWith(
      scopeStub,
      'user-1',
    );
  });
});
