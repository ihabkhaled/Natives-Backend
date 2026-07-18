import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import {
  canMemberRespond,
  isRsvpWindowOpen,
} from '../domain/rsvp-deadline.policy';
import { RsvpClosedError } from '../errors/rsvp-closed.error';
import { RsvpDeadlinePassedError } from '../errors/rsvp-deadline-passed.error';
import { RsvpNotMemberError } from '../errors/rsvp-not-member.error';
import { RsvpMembershipRepository } from '../infrastructure/rsvp-membership.repository';
import { toRsvpView } from '../lib/rsvp.mapper';
import type { PracticeSession } from '../model/practices.types';
import { RsvpNoteVisibility, RsvpSource } from '../model/rsvp.enums';
import type {
  MembershipRef,
  RsvpView,
  RsvpWriteContext,
  SetRsvpCommand,
} from '../model/rsvp.types';
import { PracticeLookupService } from './practice-lookup.service';
import { RsvpRecorderService } from './rsvp-recorder.service';

/**
 * A member sets or changes their OWN availability for a session. Enforces, in one
 * transaction: the session exists in the caller's team scope (404), is in a state
 * that accepts RSVP (409), the RSVP deadline has not passed (409), and the caller
 * has an active membership in the team (403). Optimistic version guards concurrent
 * edits from multiple devices. Records intent only — never attendance or points.
 */
@Injectable()
export class SetOwnRsvpUseCase {
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
    command: SetRsvpCommand,
  ): Promise<RsvpView> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, teamId, sessionId, command),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    command: SetRsvpCommand,
  ): Promise<RsvpView> {
    const session = await this.lookup.requireSession(scope, teamId, sessionId);
    if (!canMemberRespond(session.status)) {
      throw new RsvpClosedError();
    }
    const now = this.clock.now();
    if (!isRsvpWindowOpen(now, session.rsvpCutoffAt)) {
      throw new RsvpDeadlinePassedError();
    }
    const membership = await this.requireMembership(
      scope,
      teamId,
      actor.userId,
    );
    const outcome = await this.recorder.record(
      scope,
      this.buildContext(session, membership, command, actor, now),
    );
    return toRsvpView(outcome.rsvp);
  }

  private async requireMembership(
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

  private buildContext(
    session: PracticeSession,
    membership: MembershipRef,
    command: SetRsvpCommand,
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
      source: RsvpSource.Self,
      isOverride: false,
      overrideReason: null,
      expectedVersion: command.expectedVersion,
      actorUserId: actor.userId,
      now,
    };
  }
}
