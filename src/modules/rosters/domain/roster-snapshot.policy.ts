import { RosterSnapshotImmutableError } from '../errors/roster-snapshot-immutable.error';
import { RosterStatus, SnapshotReason } from '../model/rosters.enums';
import type {
  RosterSnapshot,
  RosterSnapshotEntry,
} from '../model/rosters.types';

/**
 * Pure snapshot rules (UN-502). A snapshot is an immutable point-in-time record
 * of a roster: once written it is never edited, re-derived, or reconciled against
 * later squad or roster changes. Correcting history is done by superseding — a
 * new revision with its own snapshot — never by rewriting an existing one.
 *
 * No side effects, no time, no persistence; the database backs the same rule with
 * an ON UPDATE DO INSTEAD NOTHING rule so a stray statement cannot bypass it.
 */

const SNAPSHOT_STATES: ReadonlyMap<RosterStatus, SnapshotReason> = new Map([
  [RosterStatus.Published, SnapshotReason.Published],
  [RosterStatus.Locked, SnapshotReason.Locked],
  [RosterStatus.Revised, SnapshotReason.Revised],
]);

/** True when reaching `status` must freeze a snapshot of the roster. */
export function requiresSnapshot(status: RosterStatus): boolean {
  return SNAPSHOT_STATES.has(status);
}

/** The reason to stamp on the snapshot taken when a roster reaches `status`. */
export function resolveSnapshotReason(
  status: RosterStatus,
): SnapshotReason | null {
  return SNAPSHOT_STATES.get(status) ?? null;
}

/**
 * Guard every write path that could touch existing history. Any attempt to
 * re-record a snapshot that already exists for the same roster revision and
 * reason is a rewrite of history and is refused outright.
 */
export function assertSnapshotWritable(existing: RosterSnapshot | null): void {
  if (existing !== null) {
    throw new RosterSnapshotImmutableError();
  }
}

/**
 * True when a stored snapshot no longer matches the live roster. This is the
 * EXPECTED state after a later squad or roster change and is never an error —
 * history is supposed to diverge from the present. Reporting surfaces it; nothing
 * repairs it.
 */
export function isSnapshotSuperseded(
  snapshot: RosterSnapshot,
  liveChecksum: string,
): boolean {
  return snapshot.checksum !== liveChecksum;
}

/** The revision number a successor roster takes when superseding `revision`. */
export function nextRevision(revision: number): number {
  return revision + 1;
}

/**
 * The entries a successor revision starts from: the frozen snapshot, never the
 * live squad. Reopening a locked roster must reproduce exactly what was locked so
 * the coach edits the recorded selection rather than a silently re-derived one.
 */
export function carryForwardEntries(
  snapshot: RosterSnapshot | null,
): readonly RosterSnapshotEntry[] {
  return snapshot === null ? [] : snapshot.entries;
}
