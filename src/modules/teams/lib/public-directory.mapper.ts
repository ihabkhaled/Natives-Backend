import type { MemberDirectoryItem } from '@modules/members';

import type { PublicRosterPlayer } from '../model/public-directory.types';

/**
 * Projects a member-directory item into the publishable roster shape: drops
 * `teamId`/`status`/`hasAvatar` (not needed publicly) and adds the nullable
 * direct `photoUrl` the public roster carries (no signed/private URL is ever
 * exposed here — see `PublicTeamDirectoryService`).
 */
export function toPublicRosterPlayer(
  item: MemberDirectoryItem,
): PublicRosterPlayer {
  return {
    membershipId: item.membershipId,
    displayName: item.displayName,
    nickname: item.nickname,
    jerseyNumber: item.jerseyNumber,
    positions: item.positions,
    photoUrl: null,
  };
}
