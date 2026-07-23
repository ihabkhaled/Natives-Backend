import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import {
  type DomainEventInput,
  NotificationQuietHoursService,
  RecordDomainEventService,
} from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { resolveReminderKinds } from '../domain/practice-reminder.policy';
import { PracticeSessionNotFoundError } from '../errors/practice-session-not-found.error';
import { PracticeReminderRepository } from '../infrastructure/practice-reminder.repository';
import { PracticeSessionRepository } from '../infrastructure/practice-session.repository';
import {
  PRACTICE_CUTOFF_REMINDER_EVENT,
  PRACTICE_NO_RESPONSE_REMINDER_EVENT,
  PRACTICE_UPCOMING_REMINDER_EVENT,
  REMINDER_CANDIDATE_MAX_PAGES,
  REMINDER_CANDIDATE_MAX_RECIPIENTS,
} from '../model/calendar.constants';
import { ReminderKind } from '../model/calendar.enums';
import type {
  ReminderCandidate,
  ReminderCollectionState,
  ReminderDispatchResult,
  ReminderPreview,
  ReminderTestResult,
} from '../model/calendar.types';
import {
  PRACTICE_EVENT_VERSION,
  SESSION_AGGREGATE_TYPE,
} from '../model/practices.constants';

@Injectable()
export class PracticeReminderAdminService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly candidates: PracticeReminderRepository,
    private readonly sessions: PracticeSessionRepository,
    private readonly events: RecordDomainEventService,
    private readonly quietHours: NotificationQuietHoursService,
  ) {}

  /**
   * Coach-readable reminder status: the same eligibility/no-response/due-kind
   * projection the ops preview computes, exposed read-only. It enqueues
   * nothing — dispatch capability stays behind the ops (`jobs.manage`) routes.
   */
  status(
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
  ): Promise<ReminderPreview> {
    return this.preview(actor, teamId, sessionId);
  }

  async preview(
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
  ): Promise<ReminderPreview> {
    const settings = await this.quietHours.get(actor);
    return this.unitOfWork.runInTransaction(scope =>
      this.previewInScope(
        scope,
        teamId,
        sessionId,
        settings.urgentCancellationOverride,
      ),
    );
  }

  dispatch(
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
  ): Promise<ReminderDispatchResult> {
    return this.unitOfWork.runInTransaction(async scope => {
      await this.requireSession(scope, teamId, sessionId);
      const candidates = await this.collect(scope, teamId, sessionId);
      return this.enqueueCandidates(scope, actor.userId, candidates);
    });
  }

  async sendTest(
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
  ): Promise<ReminderTestResult> {
    const allowed = await this.quietHours.isAllowed(
      actor.userId,
      this.clock.now(),
      false,
    );
    return this.unitOfWork.runInTransaction(scope =>
      this.sendTestInScope(scope, actor, teamId, sessionId, allowed),
    );
  }

  private async previewInScope(
    scope: TransactionScope,
    teamId: string,
    sessionId: string,
    urgentOverride: boolean,
  ): Promise<ReminderPreview> {
    await this.requireSession(scope, teamId, sessionId);
    const candidates = await this.collect(scope, teamId, sessionId);
    return this.buildPreview(sessionId, candidates, urgentOverride);
  }

  private async sendTestInScope(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    allowed: boolean,
  ): Promise<ReminderTestResult> {
    await this.requireSession(scope, teamId, sessionId);
    if (!allowed) {
      return { enqueued: false, reason: 'quiet_hours' };
    }
    await this.events.enqueue(
      scope,
      this.buildTestEvent(actor.userId, teamId, sessionId),
    );
    return { enqueued: true, reason: null };
  }

  private async collect(
    scope: TransactionScope,
    teamId: string,
    sessionId: string,
  ): Promise<readonly ReminderCandidate[]> {
    return this.collectPage(scope, {
      teamId,
      sessionId,
      after: null,
      collected: [],
      pageNumber: 0,
    });
  }

  private async collectPage(
    scope: TransactionScope,
    state: ReminderCollectionState,
  ): Promise<readonly ReminderCandidate[]> {
    if (state.pageNumber === REMINDER_CANDIDATE_MAX_PAGES) {
      return state.collected.slice(0, REMINDER_CANDIDATE_MAX_RECIPIENTS);
    }
    const page = await this.candidatePage(scope, state);
    if (page.length === 0) {
      return state.collected;
    }
    return this.collectPage(scope, {
      teamId: state.teamId,
      sessionId: state.sessionId,
      after: page.at(-1)?.userId ?? null,
      collected: [...state.collected, ...page],
      pageNumber: state.pageNumber + 1,
    });
  }

  private candidatePage(
    scope: TransactionScope,
    state: ReminderCollectionState,
  ): Promise<readonly ReminderCandidate[]> {
    return this.candidates.listCandidates(
      scope,
      state.teamId,
      state.sessionId,
      state.after,
    );
  }

  private buildPreview(
    sessionId: string,
    candidates: readonly ReminderCandidate[],
    urgentCancellationOverride: boolean,
  ): ReminderPreview {
    const kinds = new Set(
      candidates.flatMap(candidate => this.kinds(candidate)),
    );
    return {
      sessionId,
      totalEligible: candidates.length,
      noResponse: candidates.filter(candidate => !candidate.hasResponded)
        .length,
      upcoming: kinds.has(ReminderKind.Upcoming),
      cutoff: kinds.has(ReminderKind.Cutoff),
      urgentCancellationOverride,
      kinds: [...kinds],
    };
  }

  private async enqueueCandidates(
    scope: TransactionScope,
    actorUserId: string,
    candidates: readonly ReminderCandidate[],
  ): Promise<ReminderDispatchResult> {
    let enqueued = 0;
    for (const candidate of candidates) {
      for (const kind of this.kinds(candidate)) {
        await this.enqueue(scope, actorUserId, candidate, kind);
        enqueued += 1;
      }
    }
    return { candidates: candidates.length, enqueued };
  }

  private enqueue(
    scope: TransactionScope,
    actorUserId: string,
    candidate: ReminderCandidate,
    kind: ReminderKind,
  ): Promise<unknown> {
    return this.events.enqueue(
      scope,
      this.buildReminderEvent(actorUserId, candidate, kind),
    );
  }

  private buildReminderEvent(
    actorUserId: string,
    candidate: ReminderCandidate,
    kind: ReminderKind,
  ): DomainEventInput {
    const eventType = this.eventType(kind);
    return {
      aggregateType: SESSION_AGGREGATE_TYPE,
      aggregateId: candidate.sessionId,
      eventType,
      eventVersion: PRACTICE_EVENT_VERSION,
      actorUserId,
      teamId: candidate.teamId,
      seasonId: candidate.seasonId,
      correlationId: null,
      causationId: null,
      payload: this.reminderPayload(eventType, candidate),
    };
  }

  private reminderPayload(
    eventType: string,
    candidate: ReminderCandidate,
  ): DomainEventInput['payload'] {
    return {
      recipientUserId: candidate.userId,
      startsAt: candidate.startsAt.toISOString(),
      notificationDedupeKey: this.dedupeKey(eventType, candidate),
    };
  }

  private buildTestEvent(
    actorUserId: string,
    teamId: string,
    sessionId: string,
  ): DomainEventInput {
    return {
      aggregateType: SESSION_AGGREGATE_TYPE,
      aggregateId: sessionId,
      eventType: PRACTICE_UPCOMING_REMINDER_EVENT,
      eventVersion: PRACTICE_EVENT_VERSION,
      actorUserId,
      teamId,
      seasonId: null,
      correlationId: null,
      causationId: null,
      payload: { recipientUserId: actorUserId, test: true },
    };
  }

  private dedupeKey(eventType: string, candidate: ReminderCandidate): string {
    return `${eventType}:${candidate.sessionId}:v${candidate.sessionVersion}`;
  }

  private kinds(candidate: ReminderCandidate): readonly ReminderKind[] {
    return resolveReminderKinds({
      now: this.clock.now(),
      startsAt: candidate.startsAt,
      rsvpCutoffAt: candidate.rsvpCutoffAt,
      hasResponded: candidate.hasResponded,
    });
  }

  private eventType(kind: ReminderKind): string {
    if (kind === ReminderKind.NoResponse) {
      return PRACTICE_NO_RESPONSE_REMINDER_EVENT;
    }
    if (kind === ReminderKind.Cutoff) {
      return PRACTICE_CUTOFF_REMINDER_EVENT;
    }
    return PRACTICE_UPCOMING_REMINDER_EVENT;
  }

  private async requireSession(
    scope: TransactionScope,
    teamId: string,
    sessionId: string,
  ): Promise<void> {
    if (
      (await this.sessions.findByIdInTeam(scope, teamId, sessionId)) === null
    ) {
      throw new PracticeSessionNotFoundError();
    }
  }
}
