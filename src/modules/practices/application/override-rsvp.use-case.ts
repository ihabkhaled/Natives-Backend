import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { canMemberRespond } from '../domain/rsvp-deadline.policy';
import { RsvpClosedError } from '../errors/rsvp-closed.error';
import { RsvpMembershipNotFoundError } from '../errors/rsvp-membership-not-found.error';
import { RsvpMembershipRepository } from '../infrastructure/rsvp-membership.repository';
import { toRsvpView } from '../lib/rsvp.mapper';
import type { PracticeSession } from '../model/practices.types';
import { RsvpNoteVisibility, RsvpSource } from '../model/rsvp.enums';
import type {
  MembershipRef,
  OverrideRsvpCommand,
  RsvpView,
  RsvpWriteContext,
} from '../model/rsvp.types';
import { PracticeLookupService } from './practice-lookup.service';
import { RsvpRecorderService } from './rsvp-recorder.service';

/**
 * A coach/admin overrides another member's availability for a session. Requires
 * the override permission (enforced at the controller) and a mandatory reason.
 * Unlike a self response it bypasses the RSVP deadline (a coach may record intent
 * after the cutoff), but the session must still be in a state that accepts RSVP and
 * the target must be an active member of the team. Every override is audited.
 */
@Injectable()
export class OverrideRsvpUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly lookup: PracticeLookupService,
    private readonly memberships: RsvpMembershipRepository,
    private readonly recorder: RsvpRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    membershipId: string,
    command: OverrideRsvpCommand,
  ): Promise<RsvpView> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, teamId, sessionId, membershipId, command),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    membershipId: string,
    command: OverrideRsvpCommand,
  ): Promise<RsvpView> {
    const session = await this.lookup.requireSession(scope, teamId, sessionId);
    if (!canMemberRespond(session.status)) {
      throw new RsvpClosedError();
    }
    const membership = await this.requireMembership(
      scope,
      teamId,
      membershipId,
    );
    const now = this.clock.now();
    const outcome = await this.recorder.record(
      scope,
      this.buildContext(session, membership, command, actor, now),
    );
    return toRsvpView(outcome.rsvp);
  }

  private async requireMembership(
    scope: TransactionScope,
    teamId: string,
    membershipId: string,
  ): Promise<MembershipRef> {
    const membership = await this.memberships.findActiveById(
      scope,
      teamId,
      membershipId,
    );
    if (membership === null) {
      throw new RsvpMembershipNotFoundError();
    }
    return membership;
  }

  private buildContext(
    session: PracticeSession,
    membership: MembershipRef,
    command: OverrideRsvpCommand,
    actor: AuthUserIdentity,
    now: Date,
  ): RsvpWriteContext {
    return {
      session,
      membershipId: membership.id,
      userId: membership.userId,
      status: command.status,
      reasonCategory: command.reasonCategory,
      note: command.note,
      noteVisibility: command.noteVisibility ?? RsvpNoteVisibility.Coaches,
      source: RsvpSource.Coach,
      isOverride: true,
      overrideReason: command.overrideReason,
      expectedVersion: command.expectedVersion,
      actorUserId: actor.userId,
      now,
    };
  }
}
