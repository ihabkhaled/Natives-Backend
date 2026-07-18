import { Role, ROLE_VALUES } from '@shared/enums';

import {
  INVITATION_STATUS_VALUES,
  InvitationStatus,
  USER_STATUS_VALUES,
  UserStatus,
} from '../model/identity.enums';

const ROLE_SET: ReadonlySet<string> = new Set(ROLE_VALUES);
const USER_STATUS_SET: ReadonlySet<string> = new Set(USER_STATUS_VALUES);
const INVITATION_STATUS_SET: ReadonlySet<string> = new Set(
  INVITATION_STATUS_VALUES,
);

/** Canonical identity key: lower-cased, trimmed email. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Map a stored role string back to the enum, defaulting to the least-privileged role. */
export function parseRole(value: string): Role {
  return ROLE_SET.has(value) ? (value as Role) : Role.User;
}

/** Map a stored user-status string back to the enum, defaulting to Inactive. */
export function parseUserStatus(value: string): UserStatus {
  return USER_STATUS_SET.has(value)
    ? (value as UserStatus)
    : UserStatus.Inactive;
}

/** Map a stored invitation-status string back to the enum, defaulting to Expired. */
export function parseInvitationStatus(value: string): InvitationStatus {
  return INVITATION_STATUS_SET.has(value)
    ? (value as InvitationStatus)
    : InvitationStatus.Expired;
}

/** Convert a nullable timestamptz value to a Date or null. */
export function toNullableDate(value: string | Date | null): Date | null {
  if (value === null) {
    return null;
  }
  return value instanceof Date ? value : new Date(value);
}

/** Convert a non-null timestamptz value to a Date. */
export function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * Return the first row of a result set that is guaranteed non-empty (e.g. an
 * INSERT ... RETURNING). Throws if the result is unexpectedly empty rather than
 * asserting non-null, so the guarantee is checked at runtime.
 */
export function firstRow<TRow>(rows: readonly TRow[]): TRow {
  const row = rows[0];
  if (row === undefined) {
    throw new Error('Expected at least one row from a returning statement');
  }
  return row;
}
