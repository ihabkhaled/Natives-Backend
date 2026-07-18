import {
  CALENDAR_PRODUCT_ID,
  CALENDAR_UID_DOMAIN,
  ICS_CONTINUATION_PREFIX,
  ICS_DATE_PATTERN,
  ICS_LINE_BREAK,
  ICS_MAX_LINE_BYTES,
  ICS_MILLISECONDS_PATTERN,
} from '../model/calendar.constants';
import { SessionStatus } from '../model/practices.enums';
import type { PracticeSession } from '../model/practices.types';

/** Build one privacy-safe RFC 5545 calendar containing visible sessions only. */
export function buildPracticeCalendar(
  sessions: readonly PracticeSession[],
  name: string,
  timezone: string,
  generatedAt: Date,
): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${CALENDAR_PRODUCT_ID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(name)}`,
    `X-WR-TIMEZONE:${escapeIcsText(timezone)}`,
    ...sessions.flatMap(session => eventLines(session, generatedAt)),
    'END:VCALENDAR',
  ];
  return `${lines.map(line => foldIcsLine(line)).join(ICS_LINE_BREAK)}${
    ICS_LINE_BREAK
  }`;
}

export function calendarEventUid(sessionId: string): string {
  return `practice-session-${sessionId}@${CALENDAR_UID_DOMAIN}`;
}

/** Fold a content line without splitting a UTF-8 character. */
export function foldIcsLine(line: string): string {
  const chunks: string[] = [];
  let chunk = '';
  let limit = ICS_MAX_LINE_BYTES;
  for (const character of line) {
    if (Buffer.byteLength(chunk + character, 'utf8') > limit) {
      chunks.push(chunk);
      chunk = character;
      limit = ICS_MAX_LINE_BYTES - 1;
    } else {
      chunk += character;
    }
  }
  chunks.push(chunk);
  return chunks.join(`${ICS_LINE_BREAK}${ICS_CONTINUATION_PREFIX}`);
}

function eventLines(
  session: PracticeSession,
  generatedAt: Date,
): readonly string[] {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${calendarEventUid(session.id)}`,
    `DTSTAMP:${toIcsUtc(generatedAt)}`,
    `SEQUENCE:${session.version}`,
    `DTSTART:${toIcsUtc(session.startsAt)}`,
    `DTEND:${toIcsUtc(session.endsAt)}`,
    `SUMMARY:${escapeIcsText(session.sessionType)}`,
    `LOCATION:${escapeIcsText(session.field ?? '')}`,
    `X-NATIVES-TIMEZONE:${escapeIcsText(session.timezone)}`,
  ];
  if (session.status === SessionStatus.Cancelled) {
    lines.push('STATUS:CANCELLED');
  } else {
    lines.push('STATUS:CONFIRMED');
  }
  lines.push('END:VEVENT');
  return lines;
}

function toIcsUtc(value: Date): string {
  return value
    .toISOString()
    .replace(ICS_DATE_PATTERN, '')
    .replace(ICS_MILLISECONDS_PATTERN, '');
}

function escapeIcsText(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('\r\n', '\\n')
    .replaceAll('\n', '\\n')
    .replaceAll(',', '\\,')
    .replaceAll(';', '\\;');
}
