import {
  ABUSE_BACKDATE_MAX_DAYS,
  ABUSE_IMPLAUSIBLE_DURATION_MINUTES,
  ABUSE_REPEATED_BUDDY_MAX,
  ABUSE_VOLUME_MAX_IN_WINDOW,
} from '../model/activities.constants';
import { AbuseSignal } from '../model/activity.enums';
import type { AbuseSignalFacts } from '../model/activity.types';

/**
 * Pure anti-abuse evaluation. Given the measured facts of one claim (counts from
 * bounded repository probes plus its own dates/duration), it raises the review
 * signals a human moderator should weigh. Signals are PROMPTS, never automated
 * guilt: the reviewer still decides. Deterministic and side-effect-free so every
 * threshold branch is unit-tested without a database.
 */

const MILLIS_PER_DAY = 86_400_000;

/**
 * Whole UTC days from `fromDay` to `toDay` (both YYYY-MM-DD). Positive when
 * `fromDay` precedes `toDay` — i.e. how far a performed date is backdated.
 */
export function daysBetween(fromDay: string, toDay: string): number {
  const from = Date.parse(`${fromDay}T00:00:00.000Z`);
  const to = Date.parse(`${toDay}T00:00:00.000Z`);
  return Math.round((to - from) / MILLIS_PER_DAY);
}

/** The ordered anti-abuse signals raised for a claim, empty when none apply. */
export function detectAbuseSignals(
  facts: AbuseSignalFacts,
): readonly AbuseSignal[] {
  const signals: AbuseSignal[] = [];
  if (facts.sameDayLiveCount > 0) {
    signals.push(AbuseSignal.DuplicateDay);
  }
  if (facts.windowLiveCount > ABUSE_VOLUME_MAX_IN_WINDOW) {
    signals.push(AbuseSignal.UnusualVolume);
  }
  if (daysBetween(facts.performedOn, facts.today) > ABUSE_BACKDATE_MAX_DAYS) {
    signals.push(AbuseSignal.ExtremeBackdating);
  }
  if (
    facts.durationMinutes !== null &&
    facts.durationMinutes > ABUSE_IMPLAUSIBLE_DURATION_MINUTES
  ) {
    signals.push(AbuseSignal.ImplausibleDuration);
  }
  if (facts.maxBuddyRepeatCount > ABUSE_REPEATED_BUDDY_MAX) {
    signals.push(AbuseSignal.RepeatedBuddy);
  }
  return signals;
}
