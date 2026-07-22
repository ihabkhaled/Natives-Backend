import { ClipTimestampIssue } from '../model/analysis.enums';
import type { ClipTimestampVerdict, ClipWindow } from '../model/analysis.types';

/**
 * Pure timestamp rule for a clip window (UN-505).
 *
 * A window must start at or after the beginning of the recording and, when an
 * end is given, end strictly after its start. The upper bound is checked ONLY
 * when the source reports a duration: a null duration means the length is not
 * known, and an unknown length is never treated as zero — it simply removes the
 * upper bound from the check instead of rejecting every clip.
 */
export function evaluateClipWindow(
  window: ClipWindow,
  durationSeconds: number | null,
): ClipTimestampVerdict {
  if (window.startSecond < 0) {
    return reject(ClipTimestampIssue.NegativeStart);
  }
  if (window.endSecond !== null && window.endSecond <= window.startSecond) {
    return reject(ClipTimestampIssue.EndBeforeStart);
  }
  if (exceedsDuration(window, durationSeconds)) {
    return reject(ClipTimestampIssue.BeyondDuration);
  }
  return { valid: true, issue: null };
}

/** Whether the window runs past a KNOWN duration. Unknown never exceeds. */
export function exceedsDuration(
  window: ClipWindow,
  durationSeconds: number | null,
): boolean {
  if (durationSeconds === null) {
    return false;
  }
  return lastSecond(window) > durationSeconds;
}

/** The last second the window touches: its end when given, else its start. */
export function lastSecond(window: ClipWindow): number {
  return window.endSecond ?? window.startSecond;
}

/**
 * The recording position of a match instant, given the source's sync offset.
 * Offsets may be negative (the recording started after the match) and the result
 * is clamped at zero so a pre-roll instant never produces a negative seek.
 */
export function toRecordingSecond(
  matchSecond: number,
  syncOffsetSeconds: number,
): number {
  return Math.max(0, matchSecond + syncOffsetSeconds);
}

function reject(issue: ClipTimestampIssue): ClipTimestampVerdict {
  return { valid: false, issue };
}
