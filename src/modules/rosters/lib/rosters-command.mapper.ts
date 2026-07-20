import { DEFAULT_MAX_SIZE, DEFAULT_MIN_SIZE } from '../model/rosters.constants';
import {
  RosterDivision,
  RosterEntryRole,
  RosterLine,
  RosterPosition,
} from '../model/rosters.enums';
import type {
  CompetitionRosterContent,
  CompetitionRosterContentInput,
  MatchRosterContent,
  MatchRosterContentInput,
  RosterConstraints,
  RosterEntryContent,
  RosterEntryContentInput,
  RosterListFilter,
  RosterListFilterInput,
} from '../model/rosters.types';

/**
 * Normalizes loosely-typed transport input into the strict command shapes. Absent
 * optional fields become explicit nulls or documented defaults — never coerced
 * away — so controllers stay a single delegation and downstream layers never see
 * `undefined`. A missing `minWomen` stays null (the division rule does not apply)
 * and is never read as zero.
 */
export function toCompetitionRosterContent(
  input: CompetitionRosterContentInput,
): CompetitionRosterContent {
  return {
    competitionId: input.competitionId,
    squadId: input.squadId ?? null,
    name: input.name,
    division: input.division ?? RosterDivision.Unspecified,
    minSize: input.minSize ?? DEFAULT_MIN_SIZE,
    maxSize: input.maxSize ?? DEFAULT_MAX_SIZE,
    minWomen: input.minWomen ?? null,
    requireCaptain: input.requireCaptain ?? true,
    selectionDeadline: input.selectionDeadline ?? null,
    notes: input.notes ?? null,
  };
}

export function toMatchRosterContent(
  input: MatchRosterContentInput,
): MatchRosterContent {
  return {
    fixtureId: input.fixtureId,
    sourceRosterId: input.sourceRosterId ?? null,
    name: input.name,
    division: input.division ?? RosterDivision.Unspecified,
    minSize: input.minSize ?? DEFAULT_MIN_SIZE,
    maxSize: input.maxSize ?? DEFAULT_MAX_SIZE,
    minWomen: input.minWomen ?? null,
    requireCaptain: input.requireCaptain ?? true,
    notes: input.notes ?? null,
  };
}

export function toRosterEntryContent(
  input: RosterEntryContentInput,
): RosterEntryContent {
  return {
    membershipId: input.membershipId,
    jerseyNumber: input.jerseyNumber ?? null,
    entryRole: input.entryRole ?? RosterEntryRole.Player,
    lineAssignment: input.lineAssignment ?? RosterLine.Any,
    fieldPosition: input.fieldPosition ?? RosterPosition.Unspecified,
    selectionReason: input.selectionReason ?? null,
  };
}

/** The allow-listed roster list filter; every absent facet stays null. */
export function toRosterListFilter(
  input: RosterListFilterInput,
): RosterListFilter {
  return {
    competitionId: input.competitionId ?? null,
    fixtureId: input.fixtureId ?? null,
    rosterKind: input.rosterKind ?? null,
  };
}

/** The composition rules a create command asks the roster to be measured by. */
export function toRosterConstraints(
  content: CompetitionRosterContent | MatchRosterContent,
): RosterConstraints {
  return {
    division: content.division,
    minSize: content.minSize,
    maxSize: content.maxSize,
    minWomen: content.minWomen,
    requireCaptain: content.requireCaptain,
  };
}

/** The composition rules a persisted roster is measured by. */
export function toStoredConstraints(roster: {
  readonly division: RosterDivision;
  readonly minSize: number;
  readonly maxSize: number;
  readonly minWomen: number | null;
  readonly requireCaptain: boolean;
}): RosterConstraints {
  return {
    division: roster.division,
    minSize: roster.minSize,
    maxSize: roster.maxSize,
    minWomen: roster.minWomen,
    requireCaptain: roster.requireCaptain,
  };
}
