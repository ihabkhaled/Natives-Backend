import type { BlockPositionWrite } from '../model/agendas.types';

/**
 * Pure ordering rules for agenda blocks. A reorder request must be a permutation of
 * exactly the agenda's current block ids — every existing block listed once, with no
 * unknown, missing, or duplicated id — so the operation can never drop, duplicate,
 * or smuggle in a foreign block. Positions are then derived from the requested order
 * (0-based, dense, gap-free). No side effects — every branch is unit-tested.
 */

/** True when `requestedIds` is a permutation of `existingIds` (each exactly once). */
export function isValidReorder(
  existingIds: readonly string[],
  requestedIds: readonly string[],
): boolean {
  if (existingIds.length !== requestedIds.length) {
    return false;
  }
  const existing = new Set(existingIds);
  const seen = new Set<string>();
  for (const id of requestedIds) {
    if (!existing.has(id) || seen.has(id)) {
      return false;
    }
    seen.add(id);
  }
  return seen.size === existing.size;
}

/** Derive dense 0-based position writes from a validated ordered id list. */
export function toPositionWrites(
  orderedIds: readonly string[],
): readonly BlockPositionWrite[] {
  return orderedIds.map((id, index) => ({ id, position: index }));
}
