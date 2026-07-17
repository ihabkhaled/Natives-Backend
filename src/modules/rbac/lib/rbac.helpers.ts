import type { PermissionScope } from '@core/auth';

/** Convert a non-null timestamptz value to a Date. */
export function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Convert a nullable timestamptz value to a Date or null. */
export function toNullableDate(value: string | Date | null): Date | null {
  if (value === null) {
    return null;
  }
  return value instanceof Date ? value : new Date(value);
}

/** Build a PermissionScope from nullable team/season ids, omitting absent ones. */
export function toPermissionScope(
  teamId: string | null,
  seasonId: string | null,
): PermissionScope {
  return {
    ...(teamId === null ? {} : { teamId }),
    ...(seasonId === null ? {} : { seasonId }),
  };
}

/** Union two permission sets into a new set (baseline ∪ scoped). */
export function unionPermissions(
  first: ReadonlySet<string>,
  second: ReadonlySet<string>,
): ReadonlySet<string> {
  return new Set([...first, ...second]);
}
