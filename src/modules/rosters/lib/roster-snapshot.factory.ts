import { createHash } from 'node:crypto';

import { activeEntries } from '../domain/roster-composition.policy';
import type { SnapshotReason } from '../model/rosters.enums';
import type {
  NewRosterSnapshot,
  Roster,
  RosterEntry,
  RosterSnapshotEntry,
} from '../model/rosters.types';

/**
 * Builds the immutable snapshot payload for a roster. The frozen record carries
 * ids and classifications only — never names or contact detail — so a historical
 * roster can be retained and audited without duplicating personal data.
 *
 * The checksum is a deterministic SHA-256 over the ordered, normalized entry
 * payload: two snapshots of the same selection produce the same checksum, and any
 * later change to the live roster produces a different one. That is how a
 * superseded snapshot is DETECTED — never how it is repaired.
 */

export function toSnapshotEntries(
  entries: readonly RosterEntry[],
): readonly RosterSnapshotEntry[] {
  return activeEntries(entries)
    .map(entry => toSnapshotEntry(entry))
    .sort((left, right) => left.membershipId.localeCompare(right.membershipId));
}

export function snapshotChecksum(
  entries: readonly RosterSnapshotEntry[],
): string {
  return createHash('sha256').update(JSON.stringify(entries)).digest('hex');
}

export function buildRosterSnapshot(
  id: string,
  roster: Roster,
  reason: SnapshotReason,
  entries: readonly RosterSnapshotEntry[],
  actorUserId: string,
  now: Date,
): NewRosterSnapshot {
  return {
    id,
    rosterId: roster.rosterId,
    teamId: roster.teamId,
    seasonId: roster.seasonId,
    competitionId: roster.competitionId,
    fixtureId: roster.fixtureId,
    rosterKind: roster.rosterKind,
    revision: roster.revision,
    reason,
    rosterStatus: roster.status,
    entryCount: entries.length,
    checksum: snapshotChecksum(entries),
    entries,
    takenBy: actorUserId,
    now,
  };
}

function toSnapshotEntry(entry: RosterEntry): RosterSnapshotEntry {
  return {
    membershipId: entry.membershipId,
    jerseyNumber: entry.jerseyNumber,
    entryRole: entry.entryRole,
    lineAssignment: entry.lineAssignment,
    fieldPosition: entry.fieldPosition,
    genderBucket: entry.genderBucket,
    availability: entry.availability,
    constraintOverridden: entry.constraintOverridden,
  };
}
