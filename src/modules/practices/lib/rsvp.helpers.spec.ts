import { describe, expect, it } from 'vitest';

import {
  RsvpNoteVisibility,
  RsvpReasonCategory,
  RsvpSource,
  RsvpStatus,
} from '../model/rsvp.enums';
import {
  parseNoteVisibility,
  parseNullableRsvpStatus,
  parseReasonCategory,
  parseRsvpSource,
  parseRsvpStatus,
  resolveRsvpFilter,
} from './rsvp.helpers';

describe('rsvp enum parsers', () => {
  it('parse a known status, source, visibility, and reason', () => {
    expect(parseRsvpStatus('going')).toBe(RsvpStatus.Going);
    expect(parseRsvpSource('coach')).toBe(RsvpSource.Coach);
    expect(parseNoteVisibility('team')).toBe(RsvpNoteVisibility.Team);
    expect(parseReasonCategory('injury')).toBe(RsvpReasonCategory.Injury);
  });

  it('preserve null for nullable status and reason', () => {
    expect(parseNullableRsvpStatus(null)).toBeNull();
    expect(parseNullableRsvpStatus('maybe')).toBe(RsvpStatus.Maybe);
    expect(parseReasonCategory(null)).toBeNull();
  });

  it('reject an unknown persisted value', () => {
    expect(() => parseRsvpStatus('unknown')).toThrow(/rsvp status/u);
    expect(() => parseReasonCategory('nope')).toThrow(/reason category/u);
    expect(() => parseNoteVisibility('nobody')).toThrow(/note visibility/u);
    expect(() => parseRsvpSource('robot')).toThrow(/rsvp source/u);
  });
});

describe('resolveRsvpFilter', () => {
  it('clamps pagination and defaults an absent status to null', () => {
    const filter = resolveRsvpFilter({});
    expect(filter.status).toBeNull();
    expect(filter.limit).toBeGreaterThan(0);
    expect(filter.offset).toBe(0);
  });

  it('passes an explicit status through and caps an oversized limit', () => {
    const filter = resolveRsvpFilter({
      status: RsvpStatus.Going,
      limit: 100000,
      offset: 5,
    });
    expect(filter.status).toBe(RsvpStatus.Going);
    expect(filter.limit).toBeLessThanOrEqual(100);
    expect(filter.offset).toBe(5);
  });
});
