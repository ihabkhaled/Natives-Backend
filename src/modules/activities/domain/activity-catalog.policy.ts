import { PointsApproval } from '../model/activity.enums';
import type { ActivityType } from '../model/activity.types';

/**
 * Pure rules for the versioned activity-type catalog. Point values are CANDIDATES:
 * a value is only resolvable once a rules owner has approved it AND a concrete
 * (null-not-zero) value exists. WFDF accreditation and custom types stay
 * unresolved (pending + null) until decided — the catalog never guesses points.
 */

/**
 * True only when the type's candidate point value is both approved and present.
 * A pending or NULL point value (WFDF/custom) is deliberately not resolvable.
 */
export function isPointValueResolvable(type: ActivityType): boolean {
  return (
    type.pointsApproval === PointsApproval.Approved &&
    type.defaultPointValue !== null
  );
}

/** The next catalog version for a new append-versioned revision of a type. */
export function nextCatalogVersion(currentVersion: number): number {
  return currentVersion + 1;
}
