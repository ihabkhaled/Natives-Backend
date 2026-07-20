import { MembershipContextService } from '@modules/members';
import { RoleAssignmentQueryService } from '@modules/rbac';
import { Injectable } from '@nestjs/common';

import { toAuthMembershipPayloads } from '../lib/membership-payload.mapper';
import type { AuthMembershipPayload } from '../model/identity.types';

/**
 * Resolves the team contexts a principal belongs to for `GET /auth/me` and the
 * login response. Reads the memberships (with their team/season labels) through
 * the members public surface and the live role assignments through the RBAC
 * public surface — two bounded queries, never one per membership — and projects
 * them with the pure payload mapper. Always self-scoped: the caller supplies the
 * user id taken from the verified token, so no other principal's data is
 * reachable. A user with no memberships gets an empty list, never a placeholder.
 */
@Injectable()
export class PrincipalMembershipsService {
  constructor(
    private readonly memberships: MembershipContextService,
    private readonly assignments: RoleAssignmentQueryService,
  ) {}

  async resolve(userId: string): Promise<readonly AuthMembershipPayload[]> {
    const contexts = await this.memberships.listForUser(userId);
    if (contexts.length === 0) {
      return [];
    }
    const live = await this.assignments.listLiveForUser(userId);
    return toAuthMembershipPayloads(contexts, live);
  }
}
