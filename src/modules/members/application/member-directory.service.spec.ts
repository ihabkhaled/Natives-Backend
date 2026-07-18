import { describe, expect, it, vi } from 'vitest';

import type { ListMembersResult } from '../model/members.types';
import { MemberDirectoryService } from './member-directory.service';

const SCOPE = {} as never;

const RESULT: ListMembersResult = {
  items: [],
  total: 0,
  limit: 20,
  offset: 0,
};

describe('MemberDirectoryService', () => {
  it('lists the directory through the unit of work', async () => {
    const memberships = { listDirectory: vi.fn().mockResolvedValue(RESULT) };
    const unitOfWork = {
      runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
    };
    const service = new MemberDirectoryService(
      unitOfWork as never,
      memberships as never,
    );

    await expect(
      service.listMembers('team-1', { limit: 20, offset: 0 }),
    ).resolves.toBe(RESULT);
    expect(memberships.listDirectory).toHaveBeenCalledWith(SCOPE, 'team-1', {
      limit: 20,
      offset: 0,
    });
  });
});
