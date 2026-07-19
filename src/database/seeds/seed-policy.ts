import { SEED_APPLIED, SEED_CHANGED, SEED_SKIPPED } from './seed.constants';
import type { SeedApplication, Seeder, SeedHistoryRecord } from './seed.types';

/**
 * Pure once-only decision for a single seeder:
 *  - no history row        -> `applied` (run it and record it)
 *  - recorded checksum same -> `skipped` (already applied; do nothing)
 *  - recorded checksum drift -> `changed` (definition changed after application;
 *    warn and do NOT re-run, so there is never a hidden mutation)
 */
export function decideSeedApplication(
  existing: SeedHistoryRecord | null,
  seeder: Seeder,
): SeedApplication {
  if (existing === null) {
    return SEED_APPLIED;
  }
  if (existing.checksum === seeder.checksum) {
    return SEED_SKIPPED;
  }
  return SEED_CHANGED;
}
