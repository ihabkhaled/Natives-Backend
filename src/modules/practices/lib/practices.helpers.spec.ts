import { describe, expect, it } from 'vitest';

import {
  RecurrenceFrequency,
  ScheduleStatus,
  SessionStatus,
  SessionVisibility,
} from '../model/practices.enums';
import type { CreateScheduleCommand } from '../model/practices.types';
import {
  isIsoCalendarDate,
  isValidLocalTime,
  isValidScheduleCommand,
  parseFrequency,
  parseScheduleStatus,
  parseSessionStatus,
  parseVisibility,
  resolveOccurrenceWindow,
  resolvePage,
  resolveSessionFilter,
  toDate,
  toNullableDate,
} from './practices.helpers';

function cmd(overrides: Partial<CreateScheduleCommand>): CreateScheduleCommand {
  return {
    seasonId: null,
    name: 'Weekly practice',
    sessionType: 'practice',
    timezone: null,
    frequency: RecurrenceFrequency.Weekly,
    intervalWeeks: 1,
    weekdays: [1],
    startTimeLocal: '18:00',
    durationMinutes: 90,
    meetOffsetMinutes: null,
    rsvpCutoffMinutes: null,
    defaultVenueId: null,
    defaultField: null,
    defaultCapacity: null,
    visibility: null,
    organizerUserId: null,
    notes: null,
    generationStart: '2026-01-05',
    generationUntil: '2026-02-28',
    exceptions: [],
    ...overrides,
  };
}

describe('date + time helpers', () => {
  it('toDate accepts a Date or an ISO string', () => {
    const date = new Date('2026-01-01T00:00:00.000Z');
    expect(toDate(date)).toBe(date);
    expect(toDate('2026-01-01T00:00:00.000Z').toISOString()).toBe(
      '2026-01-01T00:00:00.000Z',
    );
  });

  it('toNullableDate preserves null and converts otherwise', () => {
    expect(toNullableDate(null)).toBeNull();
    const date = new Date('2026-01-01T00:00:00.000Z');
    expect(toNullableDate(date)).toBe(date);
    expect(toNullableDate('2026-01-01T00:00:00.000Z')).toBeInstanceOf(Date);
  });

  it('isIsoCalendarDate rejects malformed and impossible dates', () => {
    expect(isIsoCalendarDate('2026-01-15')).toBe(true);
    expect(isIsoCalendarDate('2026-1-5')).toBe(false);
    expect(isIsoCalendarDate('2026-02-31')).toBe(false);
    expect(isIsoCalendarDate('not-a-date')).toBe(false);
  });

  it('isValidLocalTime accepts HH:MM and rejects the rest', () => {
    expect(isValidLocalTime('18:00')).toBe(true);
    expect(isValidLocalTime('23:59')).toBe(true);
    expect(isValidLocalTime('24:00')).toBe(false);
    expect(isValidLocalTime('7:5')).toBe(false);
  });
});

describe('resolvePage', () => {
  it('applies defaults and clamps to safe bounds', () => {
    expect(resolvePage(undefined, undefined)).toEqual({
      limit: 20,
      offset: 0,
    });
    expect(resolvePage(1000, -5)).toEqual({ limit: 100, offset: 0 });
    expect(resolvePage(10, 3)).toEqual({ limit: 10, offset: 3 });
  });
});

describe('enum parsers', () => {
  it('parse valid values and throw on unknown', () => {
    expect(parseSessionStatus('published')).toBe(SessionStatus.Published);
    expect(parseScheduleStatus('archived')).toBe(ScheduleStatus.Archived);
    expect(parseVisibility('coaches')).toBe(SessionVisibility.Coaches);
    expect(parseFrequency('one_off')).toBe(RecurrenceFrequency.OneOff);
    expect(() => parseSessionStatus('nope')).toThrow();
  });
});

describe('isValidScheduleCommand', () => {
  it('accepts a valid weekly schedule', () => {
    expect(isValidScheduleCommand(cmd({}))).toBe(true);
  });

  it('accepts a valid one-off schedule with no weekdays', () => {
    expect(
      isValidScheduleCommand(
        cmd({ frequency: RecurrenceFrequency.OneOff, weekdays: [] }),
      ),
    ).toBe(true);
  });

  it('rejects an invalid start time', () => {
    expect(isValidScheduleCommand(cmd({ startTimeLocal: '99:99' }))).toBe(
      false,
    );
  });

  it('rejects a horizon that ends before it starts', () => {
    expect(
      isValidScheduleCommand(
        cmd({ generationStart: '2026-03-01', generationUntil: '2026-01-01' }),
      ),
    ).toBe(false);
  });

  it('rejects an impossible horizon date', () => {
    expect(isValidScheduleCommand(cmd({ generationUntil: '2026-02-30' }))).toBe(
      false,
    );
  });

  it('rejects an invalid exception date', () => {
    expect(isValidScheduleCommand(cmd({ exceptions: ['2026-13-01'] }))).toBe(
      false,
    );
  });

  it('rejects an out-of-range weekday', () => {
    expect(isValidScheduleCommand(cmd({ weekdays: [7] }))).toBe(false);
  });

  it('rejects a non-integer weekday', () => {
    expect(isValidScheduleCommand(cmd({ weekdays: [1.5] }))).toBe(false);
  });

  it('rejects a weekly schedule with no weekdays', () => {
    expect(isValidScheduleCommand(cmd({ weekdays: [] }))).toBe(false);
  });

  it('rejects a one-off schedule that carries weekdays', () => {
    expect(
      isValidScheduleCommand(
        cmd({ frequency: RecurrenceFrequency.OneOff, weekdays: [1] }),
      ),
    ).toBe(false);
  });
});

describe('resolveSessionFilter', () => {
  it('parses every dimension and clamps pagination', () => {
    const filter = resolveSessionFilter({
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-12-31T00:00:00.000Z',
      status: SessionStatus.Published,
      sessionType: 'practice',
      seasonId: 'season-1',
      limit: 10,
      offset: 5,
    });
    expect(filter.from?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(filter.to?.toISOString()).toBe('2026-12-31T00:00:00.000Z');
    expect(filter.status).toBe(SessionStatus.Published);
    expect(filter.sessionType).toBe('practice');
    expect(filter.seasonId).toBe('season-1');
    expect(filter.limit).toBe(10);
    expect(filter.offset).toBe(5);
  });

  it('defaults absent dimensions to null and unfiltered pagination', () => {
    const filter = resolveSessionFilter({});
    expect(filter.from).toBeNull();
    expect(filter.to).toBeNull();
    expect(filter.status).toBeNull();
    expect(filter.sessionType).toBeNull();
    expect(filter.seasonId).toBeNull();
    expect(filter.limit).toBe(20);
    expect(filter.offset).toBe(0);
  });
});

describe('resolveOccurrenceWindow', () => {
  it('derives end/meet/RSVP instants around the start (summer +3h)', () => {
    const window = resolveOccurrenceWindow(
      '2026-07-15',
      '18:00',
      90,
      30,
      120,
      'Africa/Cairo',
    );
    expect(window.startsAt.toISOString()).toBe('2026-07-15T15:00:00.000Z');
    expect(window.endsAt.toISOString()).toBe('2026-07-15T16:30:00.000Z');
    expect(window.meetAt?.toISOString()).toBe('2026-07-15T14:30:00.000Z');
    expect(window.rsvpCutoffAt?.toISOString()).toBe('2026-07-15T13:00:00.000Z');
  });

  it('keeps meet/RSVP null when their offsets are null (null-not-zero)', () => {
    const window = resolveOccurrenceWindow(
      '2026-01-15',
      '18:00',
      90,
      null,
      null,
      'Africa/Cairo',
    );
    expect(window.startsAt.toISOString()).toBe('2026-01-15T16:00:00.000Z');
    expect(window.meetAt).toBeNull();
    expect(window.rsvpCutoffAt).toBeNull();
  });
});
