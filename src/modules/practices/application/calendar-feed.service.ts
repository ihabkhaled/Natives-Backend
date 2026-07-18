import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  ID_GENERATOR_PORT,
  type IdGeneratorPort,
} from '@core/id-generator/id-generator.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { CalendarFeedLimitError } from '../errors/calendar-feed-limit.error';
import { CalendarFeedTimezoneError } from '../errors/calendar-feed-timezone.error';
import { CalendarFeedUnavailableError } from '../errors/calendar-feed-unavailable.error';
import { CalendarFeedTokenRepository } from '../infrastructure/calendar-feed-token.repository';
import { PracticeSessionRepository } from '../infrastructure/practice-session.repository';
import { RsvpMembershipRepository } from '../infrastructure/rsvp-membership.repository';
import {
  calendarFeedWindow,
  isValidIanaTimezone,
  resolveCalendarExpiry,
  resolveCalendarTimezone,
} from '../lib/calendar.helpers';
import { buildPracticeCalendar } from '../lib/ics-calendar';
import {
  CALENDAR_FEED_MAX_EVENTS,
  CALENDAR_FEED_MAX_PAGES,
  CALENDAR_TOKEN_MAX_ACTIVE_PER_USER_TEAM,
  CALENDAR_TOKEN_PORT,
  PUBLIC_CALENDAR_FEED_ROUTE,
} from '../model/calendar.constants';
import type {
  CalendarFeedCredentialView,
  CalendarFeedRevokeResult,
  CalendarFeedSessionCursor,
  CalendarFeedSessionPage,
  CalendarFeedToken,
  CalendarTokenPort,
  CreateCalendarFeedCommand,
  NewCalendarFeedToken,
} from '../model/calendar.types';
import type { PracticeSession } from '../model/practices.types';
import { ScopeValidationService } from './scope-validation.service';

/** Creates, revokes, and renders privacy-safe owner/team calendar feeds. */
@Injectable()
export class CalendarFeedService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    @Inject(CALENDAR_TOKEN_PORT)
    private readonly tokenAdapter: CalendarTokenPort,
    private readonly scopeValidation: ScopeValidationService,
    private readonly memberships: RsvpMembershipRepository,
    private readonly tokens: CalendarFeedTokenRepository,
    private readonly sessions: PracticeSessionRepository,
  ) {}

  create(
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateCalendarFeedCommand,
  ): Promise<CalendarFeedCredentialView> {
    return this.unitOfWork.runInTransaction(scope =>
      this.createInScope(scope, actor, teamId, command),
    );
  }

  revoke(
    actor: AuthUserIdentity,
    teamId: string,
    feedId: string,
  ): Promise<CalendarFeedRevokeResult> {
    return this.unitOfWork.runInTransaction(async scope => {
      const revoked = await this.tokens.revokeOwned(
        scope,
        feedId,
        actor.userId,
        teamId,
        this.clock.now(),
      );
      if (!revoked) {
        throw new CalendarFeedUnavailableError();
      }
      return { id: feedId, revoked };
    });
  }

  render(rawToken: string): Promise<string> {
    return this.unitOfWork.runInTransaction(scope =>
      this.renderInScope(scope, rawToken),
    );
  }

  private async createInScope(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateCalendarFeedCommand,
  ): Promise<CalendarFeedCredentialView> {
    await this.scopeValidation.validate(scope, teamId, command.seasonId, null);
    await this.requireMembership(scope, teamId, actor.userId);
    const now = this.clock.now();
    await this.requireCapacity(scope, actor.userId, teamId, now);
    return this.issue(scope, actor.userId, teamId, command, now);
  }

  private async issue(
    scope: TransactionScope,
    userId: string,
    teamId: string,
    command: CreateCalendarFeedCommand,
    now: Date,
  ): Promise<CalendarFeedCredentialView> {
    const timezone = this.requireTimezone(command);
    const credential = this.tokenAdapter.issue();
    const token = this.buildToken(
      credential.digest,
      userId,
      teamId,
      timezone,
      command,
      now,
    );
    await this.tokens.insert(scope, token);
    return this.toCredentialView(token, credential.raw);
  }

  private requireTimezone(command: CreateCalendarFeedCommand): string {
    const timezone = resolveCalendarTimezone(command);
    if (!isValidIanaTimezone(timezone)) {
      throw new CalendarFeedTimezoneError();
    }
    return timezone;
  }

  private toCredentialView(
    token: NewCalendarFeedToken,
    rawToken: string,
  ): CalendarFeedCredentialView {
    return {
      id: token.id,
      token: rawToken,
      feedPath: PUBLIC_CALENDAR_FEED_ROUTE.replace(':feedToken', rawToken),
      teamId: token.teamId,
      seasonId: token.seasonId,
      timezone: token.timezone,
      expiresAt: token.expiresAt,
    };
  }

  private buildToken(
    digest: string,
    userId: string,
    teamId: string,
    timezone: string,
    command: CreateCalendarFeedCommand,
    now: Date,
  ): NewCalendarFeedToken {
    return {
      id: this.idGenerator.generate(),
      tokenDigest: digest,
      userId,
      teamId,
      seasonId: command.seasonId,
      timezone,
      expiresAt: resolveCalendarExpiry(now, command),
      revokedAt: null,
      createdAt: now,
    };
  }

  private async renderInScope(
    scope: TransactionScope,
    rawToken: string,
  ): Promise<string> {
    const now = this.clock.now();
    const token = await this.requireUsableToken(scope, rawToken, now);
    const sessions = await this.collectSessions(scope, token, now);
    return buildPracticeCalendar(
      sessions,
      'Ultimate Natives practices',
      token.timezone,
      now,
    );
  }

  private async requireUsableToken(
    scope: TransactionScope,
    rawToken: string,
    now: Date,
  ): Promise<CalendarFeedToken> {
    const digest = this.tokenAdapter.digest(rawToken);
    const token = await this.tokens.findUsableByDigest(scope, digest, now);
    if (!token) {
      throw new CalendarFeedUnavailableError();
    }
    return token;
  }

  private async collectSessions(
    scope: TransactionScope,
    token: CalendarFeedToken,
    now: Date,
  ): Promise<readonly PracticeSession[]> {
    return this.collectPage(
      scope,
      token,
      now,
      { startsAt: null, id: null },
      [],
      0,
    );
  }

  private async collectPage(
    scope: TransactionScope,
    token: CalendarFeedToken,
    now: Date,
    cursor: CalendarFeedSessionCursor,
    collected: readonly PracticeSession[],
    pageNumber: number,
  ): Promise<readonly PracticeSession[]> {
    if (pageNumber === CALENDAR_FEED_MAX_PAGES) {
      return collected.slice(0, CALENDAR_FEED_MAX_EVENTS);
    }
    const page = await this.loadCalendarPage(scope, token, now, cursor);
    const items = [...collected, ...page.items];
    if (page.nextStartsAt === null || page.nextId === null) {
      return items;
    }
    return this.collectNextPage(scope, token, now, page, items, pageNumber);
  }

  private collectNextPage(
    scope: TransactionScope,
    token: CalendarFeedToken,
    now: Date,
    page: CalendarFeedSessionPage,
    items: readonly PracticeSession[],
    pageNumber: number,
  ): Promise<readonly PracticeSession[]> {
    return this.collectPage(
      scope,
      token,
      now,
      {
        startsAt: page.nextStartsAt,
        id: page.nextId,
      },
      items,
      pageNumber + 1,
    );
  }

  private loadCalendarPage(
    scope: TransactionScope,
    token: CalendarFeedToken,
    now: Date,
    cursor: CalendarFeedSessionCursor,
  ): Promise<CalendarFeedSessionPage> {
    return this.sessions.listCalendarPage(
      scope,
      token,
      calendarFeedWindow(now),
      cursor,
    );
  }

  private async requireMembership(
    scope: TransactionScope,
    teamId: string,
    userId: string,
  ): Promise<void> {
    const membership = await this.memberships.findActiveByUser(
      scope,
      teamId,
      userId,
    );
    if (membership === null) {
      throw new CalendarFeedUnavailableError();
    }
  }

  private async requireCapacity(
    scope: TransactionScope,
    userId: string,
    teamId: string,
    now: Date,
  ): Promise<void> {
    const count = await this.tokens.countActive(scope, userId, teamId, now);
    if (count >= CALENDAR_TOKEN_MAX_ACTIVE_PER_USER_TEAM) {
      throw new CalendarFeedLimitError();
    }
  }
}
