import { describe, expect, it } from 'vitest';

import { RosterSnapshotImmutableError } from '../errors/roster-snapshot-immutable.error';
import {
  RosterEntryRole,
  RosterGenderBucket,
  RosterKind,
  RosterLine,
  RosterPosition,
  RosterStatus,
  SnapshotReason,
} from '../model/rosters.enums';
import type { RosterSnapshot } from '../model/rosters.types';
import {
  assertSnapshotWritable,
  carryForwardEntries,
  isSnapshotSuperseded,
  nextRevision,
  requiresSnapshot,
  resolveSnapshotReason,
} from './roster-snapshot.policy';

const TAKEN_AT = new Date('2026-03-01T10:00:00.000Z');

function snapshot(overrides: Partial<RosterSnapshot> = {}): RosterSnapshot {
  return {
    snapshotId: 'snap-1',
    rosterId: 'roster-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    competitionId: 'comp-1',
    fixtureId: null,
    rosterKind: RosterKind.Competition,
    revision: 1,
    reason: SnapshotReason.Locked,
    rosterStatus: RosterStatus.Locked,
    entryCount: 1,
    checksum: 'abc',
    entries: [
      {
        membershipId: 'member-1',
        jerseyNumber: 7,
        entryRole: RosterEntryRole.Player,
        lineAssignment: RosterLine.Any,
        fieldPosition: RosterPosition.Unspecified,
        genderBucket: RosterGenderBucket.Men,
        availability: null,
        constraintOverridden: false,
      },
    ],
    takenBy: 'user-1',
    takenAt: TAKEN_AT,
    ...overrides,
  };
}

describe('roster-snapshot.policy', () => {
  it('freezes a snapshot for published, locked, and revised states only', () => {
    expect(requiresSnapshot(RosterStatus.Published)).toBe(true);
    expect(requiresSnapshot(RosterStatus.Locked)).toBe(true);
    expect(requiresSnapshot(RosterStatus.Revised)).toBe(true);
    expect(requiresSnapshot(RosterStatus.Draft)).toBe(false);
    expect(requiresSnapshot(RosterStatus.Archived)).toBe(false);
  });

  it('resolves the reason stamped on each snapshot, or null when none is taken', () => {
    expect(resolveSnapshotReason(RosterStatus.Published)).toBe(
      SnapshotReason.Published,
    );
    expect(resolveSnapshotReason(RosterStatus.Locked)).toBe(
      SnapshotReason.Locked,
    );
    expect(resolveSnapshotReason(RosterStatus.Revised)).toBe(
      SnapshotReason.Revised,
    );
    expect(resolveSnapshotReason(RosterStatus.Draft)).toBeNull();
    expect(resolveSnapshotReason(RosterStatus.Archived)).toBeNull();
  });

  it('accepts a first write and refuses rewriting an existing snapshot', () => {
    expect(() => {
      assertSnapshotWritable(null);
    }).not.toThrow();
    expect(() => {
      assertSnapshotWritable(snapshot());
    }).toThrow(RosterSnapshotImmutableError);
  });

  it('detects divergence from the live roster without ever repairing it', () => {
    const frozen = snapshot({ checksum: 'frozen' });
    expect(isSnapshotSuperseded(frozen, 'frozen')).toBe(false);
    expect(isSnapshotSuperseded(frozen, 'changed-after-a-squad-edit')).toBe(
      true,
    );
    expect(frozen.entries).toHaveLength(1);
  });

  it('numbers the successor revision one past the superseded one', () => {
    expect(nextRevision(1)).toBe(2);
    expect(nextRevision(9)).toBe(10);
  });

  it('carries a revision forward from the frozen snapshot, not from nothing', () => {
    expect(carryForwardEntries(snapshot())).toHaveLength(1);
    expect(carryForwardEntries(snapshot())[0]?.membershipId).toBe('member-1');
    expect(carryForwardEntries(null)).toEqual([]);
  });
});
