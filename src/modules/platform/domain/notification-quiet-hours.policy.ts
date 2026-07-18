import type { NotificationQuietHours } from '../model/platform.types';

/** True when the supplied instant falls inside the user's local quiet window. */
export function isWithinQuietHours(
  now: Date,
  quietHours: NotificationQuietHours,
): boolean {
  const current = localMinutes(now, quietHours.timezone);
  const start = parseMinutes(quietHours.startsLocal);
  const end = parseMinutes(quietHours.endsLocal);
  if (start === end) {
    return false;
  }
  return start < end
    ? current >= start && current < end
    : current >= start || current < end;
}

/** Cancellation overrides quiet hours only when the user retained that safety default. */
export function isDeliveryAllowed(
  now: Date,
  quietHours: NotificationQuietHours,
  urgentCancellation: boolean,
): boolean {
  if (!isWithinQuietHours(now, quietHours)) {
    return true;
  }
  return urgentCancellation && quietHours.urgentCancellationOverride;
}

function localMinutes(now: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(now);
  return readTimePart(parts, 'hour') * 60 + readTimePart(parts, 'minute');
}

function readTimePart(
  parts: readonly Intl.DateTimeFormatPart[],
  type: string,
): number {
  const part = parts.find(candidate => candidate.type === type);
  return part === undefined ? 0 : Number(part.value);
}

function parseMinutes(value: string): number {
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
}
