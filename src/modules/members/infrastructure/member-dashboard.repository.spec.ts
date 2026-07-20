import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MEMBERSHIP_INVITED_STATE } from '../model/members.constants';
import { MemberDashboardRepository } from './member-dashboard.repository';

describe('MemberDashboardRepository', () => {
  let repository: MemberDashboardRepository;
  let scope: { run: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repository = new MemberDashboardRepository();
    scope = { run: vi.fn().mockResolvedValue([]) };
  });

  it('reads one profile row scoped to the membership and its team', async () => {
    await repository.findProfileCompleteness(
      scope as never,
      'team-1',
      'membership-1',
    );

    expect(scope.run.mock.calls[0]?.[0]).toContain('LIMIT 1');
    expect(scope.run.mock.calls[0]?.[1]).toEqual(['membership-1', 'team-1']);
  });

  it('counts invited memberships excluding soft-deleted rows', async () => {
    await repository.countInvitedMembers(scope as never, 'team-1');

    expect(scope.run.mock.calls[0]?.[0]).toContain('"m"."deleted_at" IS NULL');
    expect(scope.run.mock.calls[0]?.[1]).toEqual([
      'team-1',
      MEMBERSHIP_INVITED_STATE,
    ]);
  });
});
