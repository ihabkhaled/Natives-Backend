import { describe, expect, it, vi } from 'vitest';

import { NotificationAudienceRepository } from './notification-audience.repository';

describe('NotificationAudienceRepository', () => {
  it('returns a bounded, keyset-ordered active team audience', async () => {
    const scope = {
      run: vi
        .fn()
        .mockResolvedValue([{ user_id: 'user-2' }, { user_id: 'user-3' }]),
    };
    const repository = new NotificationAudienceRepository();
    await expect(
      repository.listActiveTeamUsers(scope as never, 'team-1', 'user-1'),
    ).resolves.toEqual(['user-2', 'user-3']);
    expect(scope.run.mock.calls[0]?.[0]).toContain(
      'ORDER BY "memberships"."user_id" ASC',
    );
    expect(scope.run.mock.calls[0]?.[1]).toEqual(['team-1', 'user-1', 100]);
  });
});
