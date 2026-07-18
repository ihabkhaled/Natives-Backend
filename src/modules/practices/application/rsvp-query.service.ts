import type { AuthUserIdentity } from '@core/auth';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { RsvpNotMemberError } from '../errors/rsvp-not-member.error';
import { PracticeRsvpRepository } from '../infrastructure/practice-rsvp.repository';
import { PracticeRsvpRevisionRepository } from '../infrastructure/practice-rsvp-revision.repository';
import { RsvpMembershipRepository } from '../infrastructure/rsvp-membership.repository';
import { noResponseView, toRsvpSummary, toRsvpView } from '../lib/rsvp.mapper';
import { RSVP_HISTORY_SCAN_LIMIT } from '../model/rsvp.constants';
import type {
  ListRsvpRevisionsResult,
  ListRsvpsResult,
  MembershipRef,
  RsvpListFilter,
  RsvpSummary,
  RsvpView,
} from '../model/rsvp.types';
import { PracticeLookupService } from './practice-lookup.service';

/**
 * Read side for practice RSVP: a member's own answer (synthesized `no_response`
 * when absent), the privacy-safe participant list (no notes/reasons), the planning
 * summary (projected counts + derived spots remaining), and a single member's
 * revision history. Every read resolves the session within the caller's team scope
 * first, so a cross-team id is a clean not-found.
 */
@Injectable()
export class RsvpQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly lookup: PracticeLookupService,
    private readonly memberships: RsvpMembershipRepository,
    private readonly rsvps: PracticeRsvpRepository,
    private readonly revisions: PracticeRsvpRevisionRepository,
  ) {}

  getOwnRsvp(
    teamId: string,
    sessionId: string,
    actor: AuthUserIdentity,
  ): Promise<RsvpView> {
    return this.unitOfWork.runInTransaction(scope =>
      this.resolveOwn(scope, teamId, sessionId, actor),
    );
  }

  listParticipants(
    teamId: string,
    sessionId: string,
    filter: RsvpListFilter,
  ): Promise<ListRsvpsResult> {
    return this.unitOfWork.runInTransaction(async scope => {
      await this.lookup.requireSession(scope, teamId, sessionId);
      return this.rsvps.listParticipants(scope, sessionId, filter);
    });
  }

  getSummary(teamId: string, sessionId: string): Promise<RsvpSummary> {
    return this.unitOfWork.runInTransaction(async scope => {
      const s = await this.lookup.requireSession(scope, teamId, sessionId);
      const counts = await this.rsvps.summary(scope, sessionId);
      return toRsvpSummary(sessionId, s.capacity, counts);
    });
  }

  getHistory(
    teamId: string,
    sessionId: string,
    membershipId: string,
  ): Promise<ListRsvpRevisionsResult> {
    return this.unitOfWork.runInTransaction(async scope => {
      await this.lookup.requireSession(scope, teamId, sessionId);
      const items = await this.revisions.listBySessionMembership(
        scope,
        sessionId,
        membershipId,
        RSVP_HISTORY_SCAN_LIMIT,
      );
      return { items };
    });
  }

  private async resolveOwn(
    scope: TransactionScope,
    teamId: string,
    sessionId: string,
    actor: AuthUserIdentity,
  ): Promise<RsvpView> {
    await this.lookup.requireSession(scope, teamId, sessionId);
    const membership = await this.requireOwnMembership(
      scope,
      teamId,
      actor.userId,
    );
    return this.loadOwnView(scope, sessionId, membership);
  }

  private async requireOwnMembership(
    scope: TransactionScope,
    teamId: string,
    userId: string,
  ): Promise<MembershipRef> {
    const membership = await this.memberships.findActiveByUser(
      scope,
      teamId,
      userId,
    );
    if (membership === null) {
      throw new RsvpNotMemberError();
    }
    return membership;
  }

  private async loadOwnView(
    scope: TransactionScope,
    sessionId: string,
    membership: MembershipRef,
  ): Promise<RsvpView> {
    const rsvp = await this.rsvps.findBySessionMembership(
      scope,
      sessionId,
      membership.id,
    );
    return rsvp === null
      ? noResponseView(sessionId, membership.id)
      : toRsvpView(rsvp);
  }
}
