/**
 * Pure timezone conversion for practice scheduling. Recurrence is authored in a
 * local wall-clock timezone (Africa/Cairo by default) and MUST be persisted as an
 * unambiguous UTC instant — including across DST boundaries (Egypt observes DST).
 * These helpers use the platform ICU database via `Intl.DateTimeFormat`, so no
 * timezone tables are hand-maintained. No side effects, no persistence, no clock.
 */

const MS_PER_MINUTE = 60_000;

function offsetFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Read one numeric field from formatted parts, defaulting to 0 when the field is
 * absent. Exported so both branches are directly unit-tested (a live ICU
 * formatter always emits every requested field).
 */
export function readPart(
  parts: readonly Intl.DateTimeFormatPart[],
  type: string,
): number {
  const match = parts.find(part => part.type === type);
  return match === undefined ? 0 : Number(match.value);
}

/**
 * The offset (localWallClock − UTC) in milliseconds that `timeZone` applies at
 * `instant`. Positive east of UTC (Cairo is +2h standard, +3h during DST).
 */
export function getTimeZoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = offsetFormatter(timeZone).formatToParts(instant);
  const asUtc = Date.UTC(
    readPart(parts, 'year'),
    readPart(parts, 'month') - 1,
    readPart(parts, 'day'),
    readPart(parts, 'hour'),
    readPart(parts, 'minute'),
    readPart(parts, 'second'),
  );
  return asUtc - instant.getTime();
}

/**
 * Resolve a local wall-clock time in `timeZone` to its UTC instant. Uses a
 * two-pass offset correction so instants near a DST change map to the offset that
 * actually applies at the resolved instant, not the naive one.
 */
export function zonedLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute);
  const firstOffset = getTimeZoneOffsetMs(new Date(naiveUtc), timeZone);
  const candidate = new Date(naiveUtc - firstOffset);
  const secondOffset = getTimeZoneOffsetMs(candidate, timeZone);
  if (secondOffset === firstOffset) {
    return candidate;
  }
  return new Date(naiveUtc - secondOffset);
}

/**
 * Combine a `YYYY-MM-DD` local date and an `HH:MM` local time in `timeZone` into
 * the UTC instant the practice actually starts at.
 */
export function combineLocalDateTimeToUtc(
  localDate: string,
  localTime: string,
  timeZone: string,
): Date {
  // Fixed-width slices of the validated `YYYY-MM-DD` / `HH:MM` inputs. `slice`
  // always returns a string, so each field is a number with no defensive default.
  return zonedLocalToUtc(
    Number(localDate.slice(0, 4)),
    Number(localDate.slice(5, 7)),
    Number(localDate.slice(8, 10)),
    Number(localTime.slice(0, 2)),
    Number(localTime.slice(3, 5)),
    timeZone,
  );
}

/** Return a new Date `minutes` after `instant` (negative shifts earlier). */
export function addMinutes(instant: Date, minutes: number): Date {
  return new Date(instant.getTime() + minutes * MS_PER_MINUTE);
}
