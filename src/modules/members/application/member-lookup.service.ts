import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { MembershipNotFoundError } from '../errors/membership-not-found.error';
import { MemberProfileRepository } from '../infrastructure/member-profile.repository';
import { MembershipRepository } from '../infrastructure/membership.repository';
import type { MemberRecord, Membership } from '../model/members.types';

/**
 * Shared read guard for member-scoped operations: resolve a membership (and its
 * profile) within the caller's team scope, or raise a not-found error. A member
 * addressed under the wrong team never leaks existence — it is simply not found.
 */
@Injectable()
export class MemberLookupService {
  constructor(
    private readonly memberships: MembershipRepository,
    private readonly profiles: MemberProfileRepository,
  ) {}

  async requireMembership(
    scope: TransactionScope,
    teamId: string,
    membershipId: string,
  ): Promise<Membership> {
    const membership = await this.memberships.findById(
      scope,
      teamId,
      membershipId,
    );
    if (membership === null) {
      throw new MembershipNotFoundError();
    }
    return membership;
  }

  async requireRecord(
    scope: TransactionScope,
    teamId: string,
    membershipId: string,
  ): Promise<MemberRecord> {
    const membership = await this.requireMembership(
      scope,
      teamId,
      membershipId,
    );
    const profile = await this.profiles.findByMembershipId(scope, membershipId);
    if (profile === null) {
      throw new MembershipNotFoundError();
    }
    return { membership, profile };
  }
}
