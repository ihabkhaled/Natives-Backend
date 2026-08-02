import type { MemberDirectoryItem } from '@modules/members';
import { describe, expect, it } from 'vitest';

import { toPublicRosterPlayer } from './public-directory.mapper';

describe('toPublicRosterPlayer', () => {
  it('drops private fields and adds a null photoUrl', () => {
    const item: MemberDirectoryItem = {
      membershipId: 'membership-1',
      teamId: 'team-1',
      status: 'active' as never,
      displayName: 'Player One',
      nickname: 'P1',
      jerseyNumber: 7,
      positions: ['handler'],
      hasAvatar: true,
    };

    expect(toPublicRosterPlayer(item)).toEqual({
      membershipId: 'membership-1',
      displayName: 'Player One',
      nickname: 'P1',
      jerseyNumber: 7,
      positions: ['handler'],
      photoUrl: null,
    });
  });
});
