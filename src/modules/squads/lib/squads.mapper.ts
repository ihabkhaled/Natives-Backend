import {
  AVAILABILITY_SOURCE_VALUES,
  AVAILABILITY_STATUS_VALUES,
  CANDIDATE_STATUS_VALUES,
  SELECTION_ROLE_VALUES,
  SELECTION_STATUS_VALUES,
  SQUAD_STATUS_VALUES,
} from '../model/squads.enums';
import type {
  AvailabilityRow,
  CandidateRow,
  SelectionRow,
  SquadRow,
} from '../model/squads.rows';
import type {
  Availability,
  EligibilityInputs,
  Squad,
  SquadSelection,
} from '../model/squads.types';
import {
  parseEnumValue,
  parseNullableEnumValue,
  toDate,
  toNullableDate,
  toNumber,
} from './squads.helpers';

const UNNAMED_CANDIDATE = 'Unnamed member';

export function toSquad(row: SquadRow): Squad {
  return {
    squadId: row.id,
    teamId: row.team_id,
    seasonId: row.season_id,
    competitionId: row.competition_id,
    name: row.name,
    status: parseEnumValue(SQUAD_STATUS_VALUES, row.status, 'squad status'),
    attendanceThresholdPct: toNumber(row.attendance_threshold_pct),
    policyVersion: row.policy_version,
    selectionDeadline: toNullableDate(row.selection_deadline),
    notes: row.notes,
    revision: row.revision,
    recordVersion: row.record_version,
    createdBy: row.created_by,
    publishedBy: row.published_by,
    publishedAt: toNullableDate(row.published_at),
    lockedAt: toNullableDate(row.locked_at),
    archivedAt: toNullableDate(row.archived_at),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function toSelection(row: SelectionRow): SquadSelection {
  return {
    selectionId: row.id,
    squadId: row.squad_id,
    teamId: row.team_id,
    membershipId: row.membership_id,
    selectionRole: parseEnumValue(
      SELECTION_ROLE_VALUES,
      row.selection_role,
      'selection role',
    ),
    status: parseEnumValue(
      SELECTION_STATUS_VALUES,
      row.status,
      'selection status',
    ),
    reason: row.reason,
    eligibilityOverridden: row.eligibility_overridden,
    overrideReason: row.override_reason,
    overriddenBy: row.overridden_by,
    eligibilitySnapshot: row.eligibility_snapshot,
    selectedBy: row.selected_by,
    removedBy: row.removed_by,
    removedAt: toNullableDate(row.removed_at),
    recordVersion: row.record_version,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function toAvailability(row: AvailabilityRow): Availability {
  return {
    availabilityId: row.id,
    squadId: row.squad_id,
    teamId: row.team_id,
    membershipId: row.membership_id,
    availability: parseEnumValue(
      AVAILABILITY_STATUS_VALUES,
      row.availability,
      'availability',
    ),
    reason: row.reason,
    source: parseEnumValue(AVAILABILITY_SOURCE_VALUES, row.source, 'source'),
    declaredBy: row.declared_by,
    recordVersion: row.record_version,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

/**
 * Map a raw candidate-pool row into the pure eligibility inputs. Attendance stays
 * a numerator/denominator pair; the availability declaration is parsed to the
 * closed set (null when undeclared) so the policy owns the null-not-zero decision.
 */
export function toEligibilityInputs(row: CandidateRow): EligibilityInputs {
  return {
    membershipId: row.membership_id,
    fullName: row.full_name ?? UNNAMED_CANDIDATE,
    status: parseEnumValue(
      CANDIDATE_STATUS_VALUES,
      row.status,
      'candidate status',
    ),
    registeredInSeason: row.registered_in_season,
    gender: row.gender,
    jerseyNumber: row.jersey_number,
    attendedSessions: row.attended_sessions,
    eligibleSessions: row.eligible_sessions,
    injuredSessions: row.injured_sessions,
    availability: parseNullableEnumValue(
      AVAILABILITY_STATUS_VALUES,
      row.availability,
      'availability',
    ),
    selected: row.selected,
    selectionOverridden: row.selection_overridden,
  };
}
