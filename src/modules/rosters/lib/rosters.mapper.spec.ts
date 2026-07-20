import { describe, expect, it } from 'vitest';

import {
  RosterAvailabilitySource,
  RosterAvailabilityStatus,
  RosterDivision,
  RosterEntryRole,
  RosterEntryStatus,
  RosterGenderBucket,
  RosterKind,
  RosterLine,
  RosterMemberStatus,
  RosterPosition,
  RosterStatus,
  SnapshotReason,
} from '../model/rosters.enums';
import type {
  RosterAvailabilityRow,
  RosterCandidateRow,
  RosterEntryRow,
  RosterRow,
  RosterSnapshotRow,
} from '../model/rosters.rows';
import {
  toRoster,
  toRosterAvailability,
  toRosterCandidate,
  toRosterEntry,
  toRosterSnapshot,
  toSnapshotEntry,
} from './rosters.mapper';

const NOW = new Date('2026-03-01T10:00:00.000Z');

function rosterRow(overrides: Partial<RosterRow> = {}): RosterRow {
  return {
    id: 'roster-1',
    team_id: 'team-1',
    season_id: 'season-1',
    competition_id: 'comp-1',
    fixture_id: null,
    squad_id: 'squad-1',
    source_roster_id: null,
    supersedes_roster_id: null,
    current_snapshot_id: null,
    roster_kind: 'competition',
    name: 'Nationals Roster',
    status: 'draft',
    division: 'mixed',
    min_size: 7,
    max_size: 30,
    min_women: null,
    require_captain: true,
    policy_version: 'roster-constraints-v1',
    selection_deadline: null,
    notes: null,
    revision: 1,
    record_version: 1,
    created_by: 'user-1',
    published_by: null,
    published_at: null,
    locked_by: null,
    locked_at: null,
    revised_by: null,
    revised_at: null,
    revision_reason: null,
    archived_at: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function entryRow(overrides: Partial<RosterEntryRow> = {}): RosterEntryRow {
  return {
    id: 'entry-1',
    roster_id: 'roster-1',
    team_id: 'team-1',
    membership_id: 'member-1',
    jersey_number: 7,
    entry_role: 'captain',
    line_assignment: 'offense',
    field_position: 'handler',
    gender_bucket: 'women',
    status: 'selected',
    availability: 'available',
    selection_reason: null,
    constraint_overridden: false,
    override_reason: null,
    overridden_by: null,
    selected_by: 'user-1',
    removed_by: null,
    removed_at: null,
    removal_reason: null,
    record_version: 1,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function snapshotRow(
  overrides: Partial<RosterSnapshotRow> = {},
): RosterSnapshotRow {
  return {
    id: 'snap-1',
    roster_id: 'roster-1',
    team_id: 'team-1',
    season_id: 'season-1',
    competition_id: 'comp-1',
    fixture_id: null,
    roster_kind: 'competition',
    revision: 1,
    reason: 'locked',
    roster_status: 'locked',
    entry_count: 1,
    checksum: 'abc',
    entries: [
      {
        membershipId: 'member-1',
        jerseyNumber: 7,
        entryRole: 'player',
        lineAssignment: 'any',
        fieldPosition: 'unspecified',
        genderBucket: 'men',
        availability: null,
        constraintOverridden: false,
      },
    ],
    taken_by: 'user-1',
    taken_at: NOW,
    ...overrides,
  };
}

describe('rosters.mapper', () => {
  it('maps a roster row into the aggregate with parsed classifications', () => {
    const roster = toRoster(rosterRow());
    expect(roster.rosterId).toBe('roster-1');
    expect(roster.rosterKind).toBe(RosterKind.Competition);
    expect(roster.status).toBe(RosterStatus.Draft);
    expect(roster.division).toBe(RosterDivision.Mixed);
    expect(roster.minWomen).toBeNull();
    expect(roster.selectionDeadline).toBeNull();
    expect(roster.createdAt.toISOString()).toBe(NOW.toISOString());
  });

  it('preserves every recorded instant and actor on a superseded roster', () => {
    const roster = toRoster(
      rosterRow({
        status: 'revised',
        published_by: 'user-1',
        published_at: NOW,
        locked_by: 'user-2',
        locked_at: NOW,
        revised_by: 'user-3',
        revised_at: NOW,
        revision_reason: 'injury replacement',
        archived_at: NOW,
        min_women: 5,
        current_snapshot_id: 'snap-1',
        fixture_id: 'fixture-1',
        roster_kind: 'match',
      }),
    );
    expect(roster.status).toBe(RosterStatus.Revised);
    expect(roster.rosterKind).toBe(RosterKind.Match);
    expect(roster.revisionReason).toBe('injury replacement');
    expect(roster.minWomen).toBe(5);
    expect(roster.currentSnapshotId).toBe('snap-1');
    expect(roster.lockedAt?.toISOString()).toBe(NOW.toISOString());
  });

  it('maps an entry row, keeping an undeclared availability null', () => {
    const entry = toRosterEntry(entryRow());
    expect(entry.entryRole).toBe(RosterEntryRole.Captain);
    expect(entry.lineAssignment).toBe(RosterLine.Offense);
    expect(entry.fieldPosition).toBe(RosterPosition.Handler);
    expect(entry.genderBucket).toBe(RosterGenderBucket.Women);
    expect(entry.status).toBe(RosterEntryStatus.Selected);
    expect(entry.availability).toBe(RosterAvailabilityStatus.Available);
    expect(
      toRosterEntry(entryRow({ availability: null })).availability,
    ).toBeNull();
    expect(
      toRosterEntry(entryRow({ jersey_number: null })).jerseyNumber,
    ).toBeNull();
  });

  it('maps an availability row', () => {
    const row: RosterAvailabilityRow = {
      id: 'av-1',
      roster_id: 'roster-1',
      team_id: 'team-1',
      membership_id: 'member-1',
      availability: 'tentative',
      reason: 'exams',
      source: 'self',
      declared_by: 'user-1',
      record_version: 2,
      created_at: NOW,
      updated_at: NOW,
    };
    const record = toRosterAvailability(row);
    expect(record.availability).toBe(RosterAvailabilityStatus.Tentative);
    expect(record.source).toBe(RosterAvailabilitySource.Self);
    expect(record.recordVersion).toBe(2);
  });

  it('re-validates a stored snapshot payload rather than trusting it', () => {
    const snapshot = toRosterSnapshot(snapshotRow());
    expect(snapshot.reason).toBe(SnapshotReason.Locked);
    expect(snapshot.rosterStatus).toBe(RosterStatus.Locked);
    expect(snapshot.entries).toHaveLength(1);
    expect(snapshot.entries[0]?.entryRole).toBe(RosterEntryRole.Player);
    expect(snapshot.entries[0]?.availability).toBeNull();
  });

  it('rejects a snapshot entry carrying an unknown classification', () => {
    expect(() =>
      toSnapshotEntry({
        membershipId: 'member-1',
        jerseyNumber: null,
        entryRole: 'mascot',
        lineAssignment: 'any',
        fieldPosition: 'unspecified',
        genderBucket: 'men',
        availability: null,
        constraintOverridden: false,
      }),
    ).toThrow('Unrecognized role: mascot');
  });

  it('maps a candidate row into the pure eligibility inputs', () => {
    const row: RosterCandidateRow = {
      membership_id: 'member-1',
      member_status: 'suspended',
      gender: 'woman',
      jersey_number: 11,
      availability: 'unavailable',
      selected_in_squad: false,
    };
    const candidate = toRosterCandidate(row);
    expect(candidate.memberStatus).toBe(RosterMemberStatus.Suspended);
    expect(candidate.availability).toBe(RosterAvailabilityStatus.Unavailable);
    expect(candidate.selectedInSquad).toBe(false);
    expect(
      toRosterCandidate({ ...row, availability: null, jersey_number: null })
        .availability,
    ).toBeNull();
  });
});
