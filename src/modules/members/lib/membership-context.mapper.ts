import type { MembershipContextRow } from '../model/members.rows';
import type { MembershipContext } from '../model/members.types';
import { parseMembershipStatus, toNullableDate } from './members.helpers';

/**
 * Map one joined membership/team/season row into the principal-facing context.
 * Season labels stay null when the join found no season: the client renders "no
 * season" rather than an invented one.
 */
export function toMembershipContext(
  row: MembershipContextRow,
): MembershipContext {
  return {
    membershipId: row.membership_id,
    teamId: row.team_id,
    teamSlug: row.team_slug,
    teamName: row.team_name,
    seasonId: row.season_id,
    seasonSlug: row.season_slug,
    seasonName: row.season_name,
    status: parseMembershipStatus(row.status),
    joinedAt: toNullableDate(row.joined_at),
  };
}
