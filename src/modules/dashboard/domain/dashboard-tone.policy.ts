import {
  BACKLOG_ATTENTION_MIN_COUNT,
  BACKLOG_CRITICAL_MIN_COUNT,
  COMPLETENESS_ATTENTION_MIN_PERCENT,
  COMPLETENESS_POSITIVE_MIN_PERCENT,
  STANDING_PODIUM_MAX_RANK,
} from '../model/dashboard.constants';
import { DashboardTone } from '../model/dashboard.enums';

/**
 * Tone rules for the dashboard, expressed as thresholds rather than scattered
 * conditionals. All pure: a null input is always neutral, because "not
 * evaluated" is never an alarm.
 */

/** A backlog gets louder as it grows; nothing pending stays neutral. */
export function toneForBacklog(count: number | null): DashboardTone {
  if (count === null) {
    return DashboardTone.Neutral;
  }
  if (count >= BACKLOG_CRITICAL_MIN_COUNT) {
    return DashboardTone.Critical;
  }
  if (count >= BACKLOG_ATTENTION_MIN_COUNT) {
    return DashboardTone.Attention;
  }
  return DashboardTone.Neutral;
}

/** Profile completeness: high is good, low asks the member to act. */
export function toneForCompleteness(percent: number | null): DashboardTone {
  if (percent === null) {
    return DashboardTone.Neutral;
  }
  if (percent >= COMPLETENESS_POSITIVE_MIN_PERCENT) {
    return DashboardTone.Positive;
  }
  if (percent >= COMPLETENESS_ATTENTION_MIN_PERCENT) {
    return DashboardTone.Neutral;
  }
  return DashboardTone.Attention;
}

/** A podium standing is celebrated; anything else is simply informative. */
export function toneForStanding(rank: number | null): DashboardTone {
  if (rank === null) {
    return DashboardTone.Neutral;
  }
  return rank <= STANDING_PODIUM_MAX_RANK
    ? DashboardTone.Positive
    : DashboardTone.Neutral;
}
