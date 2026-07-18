import { describe, expect, it } from 'vitest';

import { SessionStatus, SessionVisibility } from '../model/practices.enums';
import type { PracticeSession } from '../model/practices.types';
import {
  buildPracticeCalendar,
  calendarEventUid,
  foldIcsLine,
} from './ics-calendar';

const NOW = new Date('2026-07-18T10:00:00.000Z');

function session(overrides: Partial<PracticeSession> = {}): PracticeSession {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    teamId: '22222222-2222-4222-8222-222222222222',
    seasonId: null,
    scheduleId: null,
    occurrenceDate: null,
    sessionType: 'Ultimate practice, offense; defense',
    timezone: 'Africa/Cairo',
    venueId: null,
    field: 'Pitch 1',
    capacity: null,
    meetAt: null,
    startsAt: new Date('2026-07-19T15:00:00.000Z'),
    endsAt: new Date('2026-07-19T17:00:00.000Z'),
    rsvpCutoffAt: null,
    visibility: SessionVisibility.Team,
    organizerUserId: null,
    notes: 'PRIVATE: player list and coach note',
    status: SessionStatus.Published,
    cancellationReason: null,
    createdBy: null,
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    version: 3,
    ...overrides,
  };
}

describe('practice ICS calendar', () => {
  it('generates parseable RFC-shaped CRLF content with stable UID and sequence', () => {
    const value = buildPracticeCalendar(
      [session()],
      'Natives practice calendar',
      'Africa/Cairo',
      NOW,
    );
    const lines = value.split('\r\n');
    const unfolded = value.replaceAll('\r\n ', '');
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines.at(-2)).toBe('END:VCALENDAR');
    expect(unfolded).toContain(
      `UID:${calendarEventUid('11111111-1111-4111-8111-111111111111')}`,
    );
    expect(value).toContain('SEQUENCE:3');
    expect(value).toContain('DTSTART:20260719T150000Z');
    expect(value).toContain('SUMMARY:Ultimate practice\\, offense\\; defense');
    expect(value).not.toMatch(/(?<!\r)\n/u);
  });

  it('keeps the UID and increments sequence for a reschedule', () => {
    const original = buildPracticeCalendar(
      [session()],
      'Calendar',
      'Africa/Cairo',
      NOW,
    );
    const moved = buildPracticeCalendar(
      [
        session({
          status: SessionStatus.Rescheduled,
          startsAt: new Date('2026-07-20T15:00:00.000Z'),
          version: 4,
        }),
      ],
      'Calendar',
      'Africa/Cairo',
      NOW,
    );
    const unfoldedOriginal = original.replaceAll('\r\n ', '');
    const unfoldedMoved = moved.replaceAll('\r\n ', '');
    expect(unfoldedOriginal).toContain(
      `UID:${calendarEventUid('11111111-1111-4111-8111-111111111111')}`,
    );
    expect(unfoldedMoved).toContain(
      `UID:${calendarEventUid('11111111-1111-4111-8111-111111111111')}`,
    );
    expect(moved).toContain('SEQUENCE:4');
    expect(moved).toContain('DTSTART:20260720T150000Z');
  });

  it('marks a cancelled event without exposing the private reason or notes', () => {
    const value = buildPracticeCalendar(
      [
        session({
          status: SessionStatus.Cancelled,
          cancellationReason: 'PRIVATE medical reason',
        }),
      ],
      'Calendar',
      'Africa/Cairo',
      NOW,
    );
    expect(value).toContain('STATUS:CANCELLED');
    expect(value).not.toContain('PRIVATE');
    expect(value).not.toContain('player list');
    expect(value).not.toContain('coach note');
  });

  it('folds long UTF-8 lines at a safe byte boundary', () => {
    const folded = foldIcsLine(`SUMMARY:${'Ø§'.repeat(80)}`);
    expect(folded).toContain('\r\n ');
    for (const line of folded.split('\r\n')) {
      expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75);
    }
  });
});
