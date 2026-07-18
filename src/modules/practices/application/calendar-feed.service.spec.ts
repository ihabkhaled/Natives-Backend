import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CalendarFeedLimitError } from '../errors/calendar-feed-limit.error';
import { CalendarFeedTimezoneError } from '../errors/calendar-feed-timezone.error';
import { CalendarFeedUnavailableError } from '../errors/calendar-feed-unavailable.error';
import { CALENDAR_TOKEN_TTL_DAYS_DEFAULT } from '../model/calendar.constants';
import type {
  CalendarFeedToken,
  CalendarTokenCredential,
} from '../model/calendar.types';
import { DEFAULT_TIMEZONE } from '../model/practices.constants';
import { SessionStatus, SessionVisibility } from '../model/practices.enums';
import type { PracticeSession } from '../model/practices.types';
import { CalendarFeedService } from './calendar-feed.service';

const NOW = new Date('2026-07-18T10:00:00.000Z');
const ACTOR = { userId: 'user-1', email: 'm@example.test', roles: [] };
const SCOPE = {} as never;
const CREDENTIAL: CalendarTokenCredential = {
  raw: 'A'.repeat(43),
  digest: 'b'.repeat(64),
};

function feedToken(
  overrides: Partial<CalendarFeedToken> = {},
): CalendarFeedToken {
  return {
    id: 'feed-1',
    tokenDigest: CREDENTIAL.digest,
    userId: ACTOR.userId,
    teamId: 'team-1',
    seasonId: null,
    timezone: DEFAULT_TIMEZONE,
    expiresAt: new Date('2027-01-14T10:00:00.000Z'),
    revokedAt: null,
    createdAt: NOW,
    ...overrides,
  };
}

function session(): PracticeSession {
  return {
    id: 'session-1',
    teamId: 'team-1',
    seasonId: null,
    scheduleId: null,
    occurrenceDate: null,
    sessionType: 'Practice',
    timezone: DEFAULT_TIMEZONE,
    venueId: null,
    field: 'Pitch 1',
    capacity: null,
    meetAt: null,
    startsAt: new Date('2026-07-19T15:00:00.000Z'),
    endsAt: new Date('2026-07-19T17:00:00.000Z'),
    rsvpCutoffAt: null,
    visibility: SessionVisibility.Team,
    organizerUserId: null,
    notes: 'secret note',
    status: SessionStatus.Published,
    cancellationReason: null,
    createdBy: null,
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
  };
}

function build() {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const idGenerator = { generate: vi.fn().mockReturnValue('feed-1') };
  const tokenAdapter = {
    issue: vi.fn().mockReturnValue(CREDENTIAL),
    digest: vi.fn().mockReturnValue(CREDENTIAL.digest),
  };
  const scopeValidation = { validate: vi.fn().mockResolvedValue(undefined) };
  const memberships = {
    findActiveByUser: vi
      .fn()
      .mockResolvedValue({ id: 'membership-1', userId: ACTOR.userId }),
  };
  const tokens = {
    countActive: vi.fn().mockResolvedValue(0),
    insert: vi.fn().mockResolvedValue(undefined),
    revokeOwned: vi.fn().mockResolvedValue(true),
    findUsableByDigest: vi.fn().mockResolvedValue(feedToken()),
  };
  const sessions = {
    listCalendarPage: vi.fn().mockResolvedValue({
      items: [session()],
      nextStartsAt: null,
      nextId: null,
    }),
  };
  const service = new CalendarFeedService(
    unitOfWork as never,
    clock,
    idGenerator,
    tokenAdapter,
    scopeValidation as never,
    memberships as never,
    tokens as never,
    sessions as never,
  );
  return {
    service,
    tokenAdapter,
    scopeValidation,
    memberships,
    tokens,
    sessions,
  };
}

describe('CalendarFeedService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('creates an owner/team-scoped feed and stores only the digest', async () => {
    const result = await harness.service.create(ACTOR, 'team-1', {
      seasonId: null,
      timezone: null,
      expiresInDays: null,
    });
    expect(result.token).toBe(CREDENTIAL.raw);
    expect(result.feedPath).toContain(CREDENTIAL.raw);
    expect(harness.scopeValidation.validate).toHaveBeenCalledWith(
      SCOPE,
      'team-1',
      null,
      null,
    );
    expect(harness.tokens.insert.mock.calls[0]?.[1]).toMatchObject({
      tokenDigest: CREDENTIAL.digest,
      userId: ACTOR.userId,
      teamId: 'team-1',
      timezone: DEFAULT_TIMEZONE,
    });
    expect(
      JSON.stringify(harness.tokens.insert.mock.calls[0]?.[1]),
    ).not.toContain(CREDENTIAL.raw);
    expect(result.expiresAt.getTime() - NOW.getTime()).toBe(
      CALENDAR_TOKEN_TTL_DAYS_DEFAULT * 24 * 60 * 60 * 1000,
    );
  });

  it('rejects feed creation without an active membership', async () => {
    harness.memberships.findActiveByUser.mockResolvedValue(null);
    await expect(
      harness.service.create(ACTOR, 'team-1', {
        seasonId: null,
        timezone: null,
        expiresInDays: null,
      }),
    ).rejects.toBeInstanceOf(CalendarFeedUnavailableError);
    expect(harness.tokens.insert).not.toHaveBeenCalled();
  });

  it('enforces the active credential limit', async () => {
    harness.tokens.countActive.mockResolvedValue(10);
    await expect(
      harness.service.create(ACTOR, 'team-1', {
        seasonId: null,
        timezone: null,
        expiresInDays: null,
      }),
    ).rejects.toBeInstanceOf(CalendarFeedLimitError);
  });

  it('uses an explicit valid timezone and lifetime', async () => {
    const result = await harness.service.create(ACTOR, 'team-1', {
      seasonId: null,
      timezone: 'UTC',
      expiresInDays: 1,
    });
    expect(result.timezone).toBe('UTC');
    expect(result.expiresAt.getTime() - NOW.getTime()).toBe(
      24 * 60 * 60 * 1000,
    );
  });

  it('rejects an ICU-unknown timezone before storing a credential', async () => {
    await expect(
      harness.service.create(ACTOR, 'team-1', {
        seasonId: null,
        timezone: 'Not/A_Timezone',
        expiresInDays: null,
      }),
    ).rejects.toBeInstanceOf(CalendarFeedTimezoneError);
    expect(harness.tokens.insert).not.toHaveBeenCalled();
  });

  it('revokes only an owned credential in the requested team scope', async () => {
    await expect(
      harness.service.revoke(ACTOR, 'team-1', 'feed-1'),
    ).resolves.toEqual({ id: 'feed-1', revoked: true });
    harness.tokens.revokeOwned.mockResolvedValue(false);
    await expect(
      harness.service.revoke(ACTOR, 'other-team', 'feed-1'),
    ).rejects.toBeInstanceOf(CalendarFeedUnavailableError);
  });

  it('renders a usable feed and omits private practice notes', async () => {
    const value = await harness.service.render(CREDENTIAL.raw);
    expect(harness.tokenAdapter.digest).toHaveBeenCalledWith(CREDENTIAL.raw);
    expect(value).toContain('BEGIN:VCALENDAR');
    expect(value).toContain('SUMMARY:Practice');
    expect(value).not.toContain('secret note');
  });

  it('rejects an invalid, expired, revoked, or cross-scope credential generically', async () => {
    harness.tokens.findUsableByDigest.mockResolvedValue(null);
    await expect(harness.service.render(CREDENTIAL.raw)).rejects.toBeInstanceOf(
      CalendarFeedUnavailableError,
    );
  });

  it('follows bounded calendar pages and stops at the hard cap', async () => {
    const page = Array.from({ length: 100 }, (_, index) => ({
      ...session(),
      id: `session-${index}`,
    }));
    harness.sessions.listCalendarPage.mockResolvedValue({
      items: page,
      nextStartsAt: page.at(-1)?.startsAt,
      nextId: page.at(-1)?.id,
    });
    const value = await harness.service.render(CREDENTIAL.raw);
    expect(harness.sessions.listCalendarPage).toHaveBeenCalledTimes(10);
    expect(value).toContain('BEGIN:VCALENDAR');
  });
});
