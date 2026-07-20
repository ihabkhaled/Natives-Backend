import { describe, expect, it } from 'vitest';

import {
  RosterAvailabilityStatus,
  RosterDivision,
  RosterEntryRole,
  RosterEntryStatus,
  RosterGenderBucket,
  RosterKind,
  RosterLine,
  RosterPosition,
  RosterStatus,
  SnapshotReason,
} from '../model/rosters.enums';
import type { Roster, RosterEntry } from '../model/rosters.types';
import {
  buildRosterSnapshot,
  snapshotChecksum,
  toSnapshotEntries,
} from './roster-snapshot.factory';

const NOW = new Date('2026-03-01T10:00:00.000Z');

function roster(overrides: Partial<Roster> = {}): Roster {
  return {
    rosterId: 'roster-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    competitionId: 'comp-1',
    fixtureId: null,
    squadId: 'squad-1',
    sourceRosterId: null,
    supersedesRosterId: null,
    currentSnapshotId: null,
    rosterKind: RosterKind.Competition,
    name: 'Nationals Roster',
    status: RosterStatus.Locked,
    division: RosterDivision.Mixed,
    minSize: 1,
    maxSize: 30,
    minWomen: null,
    requireCaptain: false,
    policyVersion: 'roster-constraints-v1',
    selectionDeadline: null,
    notes: null,
    revision: 2,
    recordVersion: 3,
    createdBy: 'user-1',
    publishedBy: 'user-1',
    publishedAt: NOW,
    lockedBy: 'user-1',
    lockedAt: NOW,
    revisedBy: null,
    revisedAt: null,
    revisionReason: null,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function entry(overrides: Partial<RosterEntry> = {}): RosterEntry {
  return {
    entryId: 'entry-1',
    rosterId: 'roster-1',
    teamId: 'team-1',
    membershipId: 'member-b',
    jerseyNumber: 7,
    entryRole: RosterEntryRole.Player,
    lineAssignment: RosterLine.Any,
    fieldPosition: RosterPosition.Unspecified,
    genderBucket: RosterGenderBucket.Men,
    status: RosterEntryStatus.Selected,
    availability: null,
    selectionReason: 'strong handler',
    constraintOverridden: false,
    overrideReason: null,
    overriddenBy: null,
    selectedBy: 'user-1',
    removedBy: null,
    removedAt: null,
    removalReason: null,
    recordVersion: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('roster-snapshot.factory', () => {
  it('freezes only active entries, ordered deterministically by member', () => {
    const frozen = toSnapshotEntries([
      entry(),
      entry({
        entryId: 'entry-2',
        membershipId: 'member-a',
        jerseyNumber: 8,
        availability: RosterAvailabilityStatus.Tentative,
      }),
      entry({
        entryId: 'entry-3',
        membershipId: 'member-c',
        jerseyNumber: 9,
        status: RosterEntryStatus.Withdrawn,
      }),
    ]);
    expect(frozen.map(item => item.membershipId)).toEqual([
      'member-a',
      'member-b',
    ]);
  });

  it('records classifications only — never names, reasons, or actors', () => {
    const frozen = toSnapshotEntries([entry()]);
    expect(Object.keys(frozen[0] ?? {})).toEqual([
      'membershipId',
      'jerseyNumber',
      'entryRole',
      'lineAssignment',
      'fieldPosition',
      'genderBucket',
      'availability',
      'constraintOverridden',
    ]);
  });

  it('produces a stable checksum for the same selection', () => {
    const first = toSnapshotEntries([entry()]);
    const second = toSnapshotEntries([entry({ entryId: 'other-row-id' })]);
    expect(snapshotChecksum(first)).toBe(snapshotChecksum(second));
    expect(snapshotChecksum([])).toHaveLength(64);
  });

  it('produces a different checksum once the selection changes', () => {
    const before = snapshotChecksum(toSnapshotEntries([entry()]));
    const after = snapshotChecksum(
      toSnapshotEntries([entry(), entry({ membershipId: 'member-z' })]),
    );
    expect(after).not.toBe(before);
  });

  it('builds the append-only snapshot row from the roster and its entries', () => {
    const snapshot = buildRosterSnapshot(
      'snap-1',
      roster(),
      SnapshotReason.Locked,
      toSnapshotEntries([entry()]),
      'user-9',
      NOW,
    );
    expect(snapshot).toMatchObject({
      id: 'snap-1',
      rosterId: 'roster-1',
      teamId: 'team-1',
      seasonId: 'season-1',
      competitionId: 'comp-1',
      fixtureId: null,
      rosterKind: RosterKind.Competition,
      revision: 2,
      reason: SnapshotReason.Locked,
      rosterStatus: RosterStatus.Locked,
      entryCount: 1,
      takenBy: 'user-9',
      now: NOW,
    });
    expect(snapshot.checksum).toHaveLength(64);
  });

  it('carries the fixture scope of a match roster into its snapshot', () => {
    const snapshot = buildRosterSnapshot(
      'snap-2',
      roster({ rosterKind: RosterKind.Match, fixtureId: 'fixture-1' }),
      SnapshotReason.Published,
      [],
      'user-9',
      NOW,
    );
    expect(snapshot.fixtureId).toBe('fixture-1');
    expect(snapshot.rosterKind).toBe(RosterKind.Match);
    expect(snapshot.entryCount).toBe(0);
  });
});
