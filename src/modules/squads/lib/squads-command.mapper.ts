import { DEFAULT_ATTENDANCE_THRESHOLD_PCT } from '../model/squads.constants';
import { SelectionRole } from '../model/squads.enums';
import type {
  SelectionContent,
  SelectionContentInput,
  SquadContent,
  SquadContentInput,
} from '../model/squads.types';

/**
 * Normalizes loosely-typed transport input into the strict command shapes. Absent
 * optional fields become explicit nulls (never coerced away) and the attendance
 * threshold falls back to the legacy 70% CANDIDATE default, keeping controllers a
 * single delegation and downstream layers free of `undefined`.
 */
export function toSquadContent(input: SquadContentInput): SquadContent {
  return {
    name: input.name,
    seasonId: input.seasonId,
    competitionId: input.competitionId ?? null,
    attendanceThresholdPct:
      input.attendanceThresholdPct ?? DEFAULT_ATTENDANCE_THRESHOLD_PCT,
    selectionDeadline: input.selectionDeadline ?? null,
    notes: input.notes ?? null,
  };
}

export function toSelectionContent(
  input: SelectionContentInput,
): SelectionContent {
  return {
    membershipId: input.membershipId,
    selectionRole: input.selectionRole ?? SelectionRole.Player,
    reason: input.reason ?? null,
  };
}
