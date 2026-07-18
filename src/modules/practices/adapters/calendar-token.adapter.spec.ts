import { describe, expect, it } from 'vitest';

import {
  CALENDAR_TOKEN_DIGEST_PATTERN,
  CALENDAR_TOKEN_PATTERN,
} from '../model/calendar.constants';
import { CalendarTokenAdapter } from './calendar-token.adapter';

describe('CalendarTokenAdapter', () => {
  it('generates an opaque high-entropy token and a one-way digest', () => {
    const adapter = new CalendarTokenAdapter();
    const credential = adapter.issue();
    expect(credential.raw).toMatch(CALENDAR_TOKEN_PATTERN);
    expect(credential.digest).toMatch(CALENDAR_TOKEN_DIGEST_PATTERN);
    expect(credential.digest).not.toContain(credential.raw);
    expect(adapter.digest(credential.raw)).toBe(credential.digest);
  });

  it('issues distinct credentials', () => {
    const adapter = new CalendarTokenAdapter();
    expect(adapter.issue().raw).not.toBe(adapter.issue().raw);
  });
});
