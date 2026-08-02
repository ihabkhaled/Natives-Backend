import { CatalogName, ResourceStatus } from '../model/teams.enums';
import type { CatalogEntry } from '../model/teams.types';

/**
 * True when a reference-catalog entry is a live, assignable staff title: it
 * belongs to the `staff_title` catalog and has not been archived. Guards
 * assignment against a title from a different catalog (division/position/...)
 * or one an admin already retired.
 */
export function isAssignableStaffTitle(entry: CatalogEntry): boolean {
  return (
    entry.catalog === CatalogName.StaffTitle &&
    entry.status === ResourceStatus.Active
  );
}
