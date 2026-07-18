import type { ErrorMessageKey } from '@core/errors/error.types';

export const CALENDAR_TOKEN_BYTES = 32;
export const CALENDAR_TOKEN_PORT = Symbol('CALENDAR_TOKEN_PORT');
export const CALENDAR_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
export const CALENDAR_TOKEN_DIGEST_PATTERN = /^[a-f0-9]{64}$/u;
export const CALENDAR_TOKEN_TTL_DAYS_DEFAULT = 180;
export const CALENDAR_TOKEN_TTL_DAYS_MIN = 1;
export const CALENDAR_TOKEN_TTL_DAYS_MAX = 365;
export const CALENDAR_TOKEN_MAX_ACTIVE_PER_USER_TEAM = 10;

export const CALENDAR_FEEDS_ROUTE = ':teamId/practice-calendar-feeds';
export const CALENDAR_FEED_BY_ID_ROUTE =
  ':teamId/practice-calendar-feeds/:feedId';
export const PUBLIC_CALENDAR_FEED_ROUTE = 'calendar/feeds/:feedToken.ics';
export const FEED_ID_PARAM = 'feedId';
export const FEED_TOKEN_PARAM = 'feedToken';

export const CALENDAR_FEED_LOOKBACK_DAYS = 30;
export const CALENDAR_FEED_LOOKAHEAD_DAYS = 400;
export const CALENDAR_FEED_PAGE_LIMIT = 100;
export const CALENDAR_FEED_MAX_EVENTS = 1000;
export const CALENDAR_FEED_MAX_PAGES =
  CALENDAR_FEED_MAX_EVENTS / CALENDAR_FEED_PAGE_LIMIT;
export const CALENDAR_UID_DOMAIN = 'ultimate-natives.local';
export const CALENDAR_PRODUCT_ID = '-//Ultimate Natives//Practice Calendar//EN';
export const ICS_MAX_LINE_BYTES = 75;
export const ICS_CONTINUATION_PREFIX = ' ';
export const ICS_LINE_BREAK = '\r\n';
export const ICS_DATE_PATTERN = /[-:]/gu;
export const ICS_MILLISECONDS_PATTERN = /\.\d{3}/u;

export const UPCOMING_REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;
export const RSVP_CUTOFF_REMINDER_WINDOW_MS = 2 * 60 * 60 * 1000;
export const REMINDER_CANDIDATE_PAGE_LIMIT = 100;
export const REMINDER_CANDIDATE_MAX_RECIPIENTS = 1000;
export const REMINDER_CANDIDATE_MAX_PAGES =
  REMINDER_CANDIDATE_MAX_RECIPIENTS / REMINDER_CANDIDATE_PAGE_LIMIT;

export const PRACTICE_REMINDER_PREVIEW_ROUTE =
  ':teamId/practice-sessions/:sessionId/reminders/preview';
export const PRACTICE_REMINDER_DISPATCH_ROUTE =
  ':teamId/practice-sessions/:sessionId/reminders/dispatch';
export const PRACTICE_REMINDER_TEST_ROUTE =
  ':teamId/practice-sessions/:sessionId/reminders/test';

export const PRACTICE_UPCOMING_REMINDER_EVENT = 'practice.reminder.upcoming';
export const PRACTICE_NO_RESPONSE_REMINDER_EVENT =
  'practice.reminder.no_response';
export const PRACTICE_CUTOFF_REMINDER_EVENT = 'practice.reminder.cutoff';

export const CALENDAR_FEED_UNAVAILABLE_MESSAGE =
  'The calendar feed is unavailable';
export const CALENDAR_FEED_UNAVAILABLE_MESSAGE_KEY: ErrorMessageKey =
  'errors.practices.calendarFeedUnavailable';
export const CALENDAR_FEED_LIMIT_MESSAGE =
  'The active calendar feed limit was reached';
export const CALENDAR_FEED_LIMIT_MESSAGE_KEY: ErrorMessageKey =
  'errors.practices.calendarFeedLimit';
export const CALENDAR_FEED_TIMEZONE_MESSAGE =
  'The calendar feed timezone is invalid';
export const CALENDAR_FEED_TIMEZONE_MESSAGE_KEY: ErrorMessageKey =
  'errors.practices.calendarFeedTimezone';
