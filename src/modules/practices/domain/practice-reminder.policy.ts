import {
  RSVP_CUTOFF_REMINDER_WINDOW_MS,
  UPCOMING_REMINDER_WINDOW_MS,
} from '../model/calendar.constants';
import { ReminderKind } from '../model/calendar.enums';
import type { ReminderPolicyInput } from '../model/calendar.types';

/** Resolve all scheduled reminder categories due for one member/session now. */
export function resolveReminderKinds(
  input: ReminderPolicyInput,
): readonly ReminderKind[] {
  const untilStart = input.startsAt.getTime() - input.now.getTime();
  if (untilStart <= 0 || untilStart > UPCOMING_REMINDER_WINDOW_MS) {
    return [];
  }
  const kinds: ReminderKind[] = [ReminderKind.Upcoming];
  if (!input.hasResponded && isCutoffDue(input)) {
    kinds.push(ReminderKind.NoResponse, ReminderKind.Cutoff);
  }
  return kinds;
}

function isCutoffDue(input: ReminderPolicyInput): boolean {
  if (input.rsvpCutoffAt === null) {
    return false;
  }
  const untilCutoff = input.rsvpCutoffAt.getTime() - input.now.getTime();
  return untilCutoff >= 0 && untilCutoff <= RSVP_CUTOFF_REMINDER_WINDOW_MS;
}
