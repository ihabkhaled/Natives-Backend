/**
 * Pure reference-catalog rules. Historical reference values are archived, never
 * deleted, and an entry that is still referenced by downstream records may not be
 * archived — the reference must be removed first. Callers translate a positive
 * result into a blocked-archive conflict.
 */

/** An entry is in use when at least one downstream record references it. */
export function isCatalogEntryReferenced(referenceCount: number): boolean {
  return referenceCount > 0;
}
