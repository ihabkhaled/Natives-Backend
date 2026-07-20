/**
 * Hard bounds for the practices dashboard-signal reads. Every projection query
 * is capped here rather than trusting table size, so a dashboard request costs a
 * predictable amount of work no matter how large a team's history grows.
 */
export const UPCOMING_SESSIONS_MAX = 5;
export const ATTENDANCE_STATUS_MAX = 16;

/** Session lifecycle states the signal queries filter on. */
export const SESSION_PUBLISHED_STATE = 'published';
export const SESSION_DRAFT_STATE = 'draft';

/** Attendance sheet state that still needs a coach to finalize it. */
export const ATTENDANCE_SHEET_OPEN_STATE = 'open';
