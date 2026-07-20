import { describe, expect, it, vi } from 'vitest';

import { MembershipContextService } from './membership-context.service';

const NOW = new Date('2026-07-20T12:00:00.000Z');

describe('MembershipContextService', () => {
  it('reads the caller own memberships against the frozen clock', async () => {
    const scope = { run: vi.fn() };
    const unitOfWork = {
      runInTransaction: vi.fn(
        async (op: (s: typeof scope) => Promise<unknown>) => op(scope),
      ),
    };
    const clock = { now: vi.fn().mockReturnValue(NOW), uptime: vi.fn() };
    const memberships = { listForUser: vi.fn().mockResolvedValue([]) };
    const service = new MembershipContextService(
      unitOfWork as never,
      clock,
      memberships,
    );

    expect(await service.listForUser('user-1')).toEqual([]);
    expect(memberships.listForUser).toHaveBeenCalledWith(scope, 'user-1', NOW);
  });
});
