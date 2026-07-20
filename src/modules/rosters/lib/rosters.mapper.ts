import {
  ROSTER_AVAILABILITY_SOURCE_VALUES,
  ROSTER_AVAILABILITY_STATUS_VALUES,
  ROSTER_DIVISION_VALUES,
  ROSTER_ENTRY_ROLE_VALUES,
  ROSTER_ENTRY_STATUS_VALUES,
  ROSTER_GENDER_BUCKET_VALUES,
  ROSTER_KIND_VALUES,
  ROSTER_LINE_VALUES,
  ROSTER_MEMBER_STATUS_VALUES,
  ROSTER_POSITION_VALUES,
  ROSTER_STATUS_VALUES,
  SNAPSHOT_REASON_VALUES,
} from '../model/rosters.enums';
import type {
  RosterAvailabilityRow,
  RosterCandidateRow,
  RosterEntryRow,
  RosterRow,
  RosterSnapshotRow,
} from '../model/rosters.rows';
import type {
  Roster,
  RosterAvailabilityRecord,
  RosterCandidate,
  RosterEntry,
  RosterSnapshot,
  RosterSnapshotEntry,
} from '../model/rosters.types';
import {
  asArray,
  asFields,
  parseEnumValue,
  parseNullableEnumValue,
  readBoolean,
  readNullableNumber,
  readNullableString,
  readString,
  toDate,
  toNullableDate,
  toNullableNumber,
  toNumber,
} from './rosters.helpers';

export function toRoster(row: RosterRow): Roster {
  return {
    rosterId: row.id,
    teamId: row.team_id,
    seasonId: row.season_id,
    competitionId: row.competition_id,
    fixtureId: row.fixture_id,
    squadId: row.squad_id,
    sourceRosterId: row.source_roster_id,
    supersedesRosterId: row.supersedes_roster_id,
    currentSnapshotId: row.current_snapshot_id,
    rosterKind: parseEnumValue(ROSTER_KIND_VALUES, row.roster_kind, 'kind'),
    name: row.name,
    status: parseEnumValue(ROSTER_STATUS_VALUES, row.status, 'roster status'),
    division: parseEnumValue(ROSTER_DIVISION_VALUES, row.division, 'division'),
    minSize: toNumber(row.min_size),
    maxSize: toNumber(row.max_size),
    minWomen: toNullableNumber(row.min_women),
    requireCaptain: row.require_captain,
    policyVersion: row.policy_version,
    selectionDeadline: toNullableDate(row.selection_deadline),
    notes: row.notes,
    revision: toNumber(row.revision),
    recordVersion: toNumber(row.record_version),
    createdBy: row.created_by,
    publishedBy: row.published_by,
    publishedAt: toNullableDate(row.published_at),
    lockedBy: row.locked_by,
    lockedAt: toNullableDate(row.locked_at),
    revisedBy: row.revised_by,
    revisedAt: toNullableDate(row.revised_at),
    revisionReason: row.revision_reason,
    archivedAt: toNullableDate(row.archived_at),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function toRosterEntry(row: RosterEntryRow): RosterEntry {
  return {
    entryId: row.id,
    rosterId: row.roster_id,
    teamId: row.team_id,
    membershipId: row.membership_id,
    jerseyNumber: toNullableNumber(row.jersey_number),
    entryRole: parseEnumValue(ROSTER_ENTRY_ROLE_VALUES, row.entry_role, 'role'),
    lineAssignment: parseEnumValue(
      ROSTER_LINE_VALUES,
      row.line_assignment,
      'line',
    ),
    fieldPosition: parseEnumValue(
      ROSTER_POSITION_VALUES,
      row.field_position,
      'position',
    ),
    genderBucket: parseEnumValue(
      ROSTER_GENDER_BUCKET_VALUES,
      row.gender_bucket,
      'gender bucket',
    ),
    status: parseEnumValue(
      ROSTER_ENTRY_STATUS_VALUES,
      row.status,
      'entry status',
    ),
    availability: parseNullableEnumValue(
      ROSTER_AVAILABILITY_STATUS_VALUES,
      row.availability,
      'availability',
    ),
    selectionReason: row.selection_reason,
    constraintOverridden: row.constraint_overridden,
    overrideReason: row.override_reason,
    overriddenBy: row.overridden_by,
    selectedBy: row.selected_by,
    removedBy: row.removed_by,
    removedAt: toNullableDate(row.removed_at),
    removalReason: row.removal_reason,
    recordVersion: toNumber(row.record_version),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function toRosterAvailability(
  row: RosterAvailabilityRow,
): RosterAvailabilityRecord {
  return {
    availabilityId: row.id,
    rosterId: row.roster_id,
    teamId: row.team_id,
    membershipId: row.membership_id,
    availability: parseEnumValue(
      ROSTER_AVAILABILITY_STATUS_VALUES,
      row.availability,
      'availability',
    ),
    reason: row.reason,
    source: parseEnumValue(
      ROSTER_AVAILABILITY_SOURCE_VALUES,
      row.source,
      'source',
    ),
    declaredBy: row.declared_by,
    recordVersion: toNumber(row.record_version),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

/**
 * Map a stored snapshot row. The frozen entry payload is re-validated against the
 * closed enum sets rather than trusted, so a historical record can never be read
 * back as an unknown classification.
 */
export function toRosterSnapshot(row: RosterSnapshotRow): RosterSnapshot {
  return {
    snapshotId: row.id,
    rosterId: row.roster_id,
    teamId: row.team_id,
    seasonId: row.season_id,
    competitionId: row.competition_id,
    fixtureId: row.fixture_id,
    rosterKind: parseEnumValue(ROSTER_KIND_VALUES, row.roster_kind, 'kind'),
    revision: toNumber(row.revision),
    reason: parseEnumValue(SNAPSHOT_REASON_VALUES, row.reason, 'reason'),
    rosterStatus: parseEnumValue(
      ROSTER_STATUS_VALUES,
      row.roster_status,
      'roster status',
    ),
    entryCount: toNumber(row.entry_count),
    checksum: row.checksum,
    entries: asArray(row.entries).map(item => toSnapshotEntry(item)),
    takenBy: row.taken_by,
    takenAt: toDate(row.taken_at),
  };
}

export function toSnapshotEntry(value: unknown): RosterSnapshotEntry {
  const fields = asFields(value);
  return {
    membershipId: readString(fields, 'membershipId', 'membership id'),
    jerseyNumber: readNullableNumber(fields, 'jerseyNumber'),
    entryRole: parseEnumValue(
      ROSTER_ENTRY_ROLE_VALUES,
      readString(fields, 'entryRole', 'role'),
      'role',
    ),
    lineAssignment: parseEnumValue(
      ROSTER_LINE_VALUES,
      readString(fields, 'lineAssignment', 'line'),
      'line',
    ),
    fieldPosition: parseEnumValue(
      ROSTER_POSITION_VALUES,
      readString(fields, 'fieldPosition', 'position'),
      'position',
    ),
    genderBucket: parseEnumValue(
      ROSTER_GENDER_BUCKET_VALUES,
      readString(fields, 'genderBucket', 'gender bucket'),
      'gender bucket',
    ),
    availability: parseNullableEnumValue(
      ROSTER_AVAILABILITY_STATUS_VALUES,
      readNullableString(fields, 'availability'),
      'availability',
    ),
    constraintOverridden: readBoolean(fields, 'constraintOverridden'),
  };
}

/** Map a raw candidate-pool row into the pure entry-eligibility inputs. */
export function toRosterCandidate(row: RosterCandidateRow): RosterCandidate {
  return {
    membershipId: row.membership_id,
    memberStatus: parseEnumValue(
      ROSTER_MEMBER_STATUS_VALUES,
      row.member_status,
      'member status',
    ),
    gender: row.gender,
    jerseyNumber: toNullableNumber(row.jersey_number),
    availability: parseNullableEnumValue(
      ROSTER_AVAILABILITY_STATUS_VALUES,
      row.availability,
      'availability',
    ),
    selectedInSquad: row.selected_in_squad,
  };
}
