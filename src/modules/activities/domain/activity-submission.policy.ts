import { ActivityValidationError } from '../errors/activity-validation.error';
import {
  ISO_DATE_PATTERN,
  NOTES_MAX_LENGTH,
} from '../model/activities.constants';
import type {
  ActivitySubmission,
  ActivityType,
  SubmissionContent,
} from '../model/activity.types';

/**
 * Pure business rules for a member's activity submission: ownership (identity is
 * taken from the token, never the body) and server-side validation of the claimed
 * date, duration, quantity, and notes against the activity type's bounds. Points
 * and distance are never trusted from or computed for the client here — a
 * submission is a claim only.
 */

/** True when `submission` belongs to the acting member's identity. */
export function isSubmissionOwnedBy(
  submission: ActivitySubmission,
  requesterUserId: string,
): boolean {
  return submission.submitterUserId === requesterUserId;
}

/**
 * Validate the submission content against the activity type. `today` is the
 * server clock's calendar day (UTC) — an activity cannot be claimed in the
 * future. Duration/quantity are null-not-zero: absent stays null; when present
 * they must be within the type's server bounds.
 */
export function assertSubmissionContent(
  content: SubmissionContent,
  type: ActivityType,
  today: string,
): void {
  assertPerformedOn(content.performedOn, today);
  assertDuration(content.durationMinutes, type);
  assertNotes(content.notes);
}

function assertPerformedOn(performedOn: string, today: string): void {
  if (!ISO_DATE_PATTERN.test(performedOn) || !isRealCalendarDate(performedOn)) {
    throw new ActivityValidationError();
  }
  if (performedOn > today) {
    throw new ActivityValidationError();
  }
}

function assertDuration(
  durationMinutes: number | null,
  type: ActivityType,
): void {
  if (durationMinutes === null) {
    return;
  }
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
    throw new ActivityValidationError();
  }
  if (
    type.minDurationMinutes !== null &&
    durationMinutes < type.minDurationMinutes
  ) {
    throw new ActivityValidationError();
  }
  if (
    type.maxDurationMinutes !== null &&
    durationMinutes > type.maxDurationMinutes
  ) {
    throw new ActivityValidationError();
  }
}

function assertNotes(notes: string | null): void {
  if (notes !== null && notes.length > NOTES_MAX_LENGTH) {
    throw new ActivityValidationError();
  }
}

function isRealCalendarDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
