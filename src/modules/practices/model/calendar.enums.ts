/** Reminder facts supported by practice and participation notifications. */
export enum ReminderKind {
  Published = 'published',
  Upcoming = 'upcoming',
  NoResponse = 'no_response',
  Cutoff = 'cutoff',
  Rescheduled = 'rescheduled',
  Cancelled = 'cancelled',
  VenueChanged = 'venue_changed',
  AttendanceCorrected = 'attendance_corrected',
  Test = 'test',
}

export const REMINDER_KIND_VALUES: readonly ReminderKind[] =
  Object.values(ReminderKind);
