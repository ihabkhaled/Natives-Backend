import { describe, expect, it, vi } from 'vitest';

import { ListUserAssignmentsUseCase } from './list-user-assignments.use-case';

describe('ListUserAssignmentsUseCase', () => {
  it('returns the user id with its active assignments', async () => {
    const assignments = {
      listForUser: vi.fn().mockResolvedValue([{ id: 'a1' }]),
    };
    const useCase = new ListUserAssignmentsUseCase(assignments as never);

    const result = await useCase.execute('user-1');

    expect(result).toEqual({ userId: 'user-1', assignments: [{ id: 'a1' }] });
    expect(assignments.listForUser).toHaveBeenCalledWith('user-1');
  });
});
