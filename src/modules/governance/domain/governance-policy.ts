import { ATTENDANCE_ELIGIBILITY_THRESHOLD } from '../model/governance.constants';
import {
  GovernanceAudience,
  MeetingVisibility,
} from '../model/governance.enums';
import type {
  GovernanceMeeting,
  GovernanceViewer,
} from '../model/governance.types';

/**
 * Pure governance policies (UN-602, UN-603).
 *
 * Two invariants live here. First, discipline NEVER affects public rank: the
 * legacy "below 70% attendance" concern is a configurable ELIGIBILITY SIGNAL,
 * surfaced for a human to consider, and is never an automatic punishment.
 * Second, a governance TITLE is not an application PERMISSION: holding "Team
 * Captain" grants no RBAC authority — that only ever comes from an explicit role
 * assignment. Meeting minutes carry a visibility class so board discussions do
 * not leak to the whole team.
 */

/**
 * Whether an attendance ratio trips the eligibility signal. It answers "should a
 * human look at this?" — never "punish this member". A null ratio (attendance
 * not measured) is NOT below threshold: absence of data is not a failing grade.
 */
export function isBelowEligibilityThreshold(
  attendanceRatio: number | null,
): boolean {
  if (attendanceRatio === null) {
    return false;
  }
  return attendanceRatio < ATTENDANCE_ELIGIBILITY_THRESHOLD;
}

/** A governance title never carries application authorization by itself. */
export function titleGrantsPermission(): boolean {
  return false;
}

/** Whether a caller may see a meeting given its visibility. */
export function canViewMeeting(
  meeting: GovernanceMeeting,
  viewer: GovernanceViewer,
): boolean {
  if (viewer.canManage) {
    return true;
  }
  if (meeting.visibility === MeetingVisibility.Board) {
    return viewer.canReadBoard;
  }
  return meeting.visibility !== MeetingVisibility.Staff;
}

/**
 * Redact a meeting's minutes and decisions when the viewer may not read the
 * board-level record. The MINUTES are nulled and the decision register emptied —
 * the meeting still lists (title, time, status) so the calendar is intact, but
 * the confidential content never leaks.
 */
export function applyMeetingVisibility(
  meeting: GovernanceMeeting,
  viewer: GovernanceViewer,
): GovernanceMeeting {
  if (viewer.canManage || meeting.visibility !== MeetingVisibility.Board) {
    return meeting;
  }
  if (viewer.canReadBoard) {
    return meeting;
  }
  return { ...meeting, minutes: null, decisions: [] };
}

/** Map a caller's permissions to the audience the visibility rules use. */
export function audienceOf(viewer: GovernanceViewer): GovernanceAudience {
  if (viewer.canManage) {
    return GovernanceAudience.Staff;
  }
  if (viewer.canReadBoard) {
    return GovernanceAudience.Board;
  }
  return GovernanceAudience.Team;
}
