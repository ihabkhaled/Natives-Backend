import { describe, expect, it } from 'vitest';

import { sanitizeHttpRequestUrl } from './http-request-url.sanitizer';
import { REDACT_CENSOR } from './logger.constants';

const INVITATION_TOKEN = 'opaque-invitation-token-value';
const CALENDAR_FEED_TOKEN = 'opaque-calendar-feed-token-value';

describe('sanitizeHttpRequestUrl', () => {
  it('replaces only the public invitation token segment', () => {
    expect(
      sanitizeHttpRequestUrl(`/api/v1/auth/invitations/${INVITATION_TOKEN}`),
    ).toBe(`/api/v1/auth/invitations/${REDACT_CENSOR}`);
  });

  it('preserves a query string after replacing the token', () => {
    expect(
      sanitizeHttpRequestUrl(
        `/api/v1/auth/invitations/${INVITATION_TOKEN}?source=app`,
      ),
    ).toBe(`/api/v1/auth/invitations/${REDACT_CENSOR}?source=app`);
  });

  it('replaces a public calendar-feed token while preserving the ICS route shape', () => {
    expect(
      sanitizeHttpRequestUrl(
        `/api/v1/calendar/feeds/${CALENDAR_FEED_TOKEN}.ics`,
      ),
    ).toBe(`/api/v1/calendar/feeds/${REDACT_CENSOR}.ics`);
  });

  it('preserves a query string after replacing a calendar-feed token', () => {
    expect(
      sanitizeHttpRequestUrl(
        `/api/v1/calendar/feeds/${CALENDAR_FEED_TOKEN}.ics?download=1`,
      ),
    ).toBe(`/api/v1/calendar/feeds/${REDACT_CENSOR}.ics?download=1`);
  });

  it('does not alter unrelated request URLs', () => {
    expect(sanitizeHttpRequestUrl('/api/v1/auth/sessions?limit=20')).toBe(
      '/api/v1/auth/sessions?limit=20',
    );
  });

  it('does not invent a token when the route segment is empty', () => {
    expect(sanitizeHttpRequestUrl('/api/v1/auth/invitations/')).toBe(
      '/api/v1/auth/invitations/',
    );
  });

  it('redacts a malformed calendar-feed segment even when the ICS suffix is absent', () => {
    expect(
      sanitizeHttpRequestUrl(`/api/v1/calendar/feeds/${CALENDAR_FEED_TOKEN}`),
    ).toBe(`/api/v1/calendar/feeds/${REDACT_CENSOR}`);
  });

  it('does not invent a calendar-feed token when only the ICS suffix is present', () => {
    expect(sanitizeHttpRequestUrl('/api/v1/calendar/feeds/.ics')).toBe(
      '/api/v1/calendar/feeds/.ics',
    );
  });
});
