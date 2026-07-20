import type { MembershipContext } from '@modules/members';
import {
  assignmentAppliesToScope,
  type RoleAssignment,
  toRoleSlug,
} from '@modules/rbac';

import type { AuthMembershipPayload } from '../model/identity.types';

/**
 * Shape the principal's own membership contexts for the client, attaching the
 * role slugs that are live in each team/season scope. Pure: both inputs are
 * already resolved, so this is a projection with no I/O and no per-membership
 * query (the assignments are fetched once and filtered in memory).
 */
export function toAuthMembershipPayloads(
  memberships: readonly MembershipContext[],
  assignments: readonly RoleAssignment[],
): readonly AuthMembershipPayload[] {
  return memberships.map(membership => ({
    membershipId: membership.membershipId,
    teamId: membership.teamId,
    teamSlug: membership.teamSlug,
    teamName: membership.teamName,
    seasonId: membership.seasonId,
    seasonSlug: membership.seasonSlug,
    seasonName: membership.seasonName,
    status: membership.status,
    roles: rolesForMembership(assignments, membership),
  }));
}

function rolesForMembership(
  assignments: readonly RoleAssignment[],
  membership: MembershipContext,
): readonly string[] {
  const slugs = assignments
    .filter(assignment =>
      assignmentAppliesToScope(
        assignment,
        membership.teamId,
        membership.seasonId,
      ),
    )
    .map(assignment => toRoleSlug(assignment.roleKey));
  return [...new Set(slugs)].sort();
}
