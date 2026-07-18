import { UserStatus } from '../model/identity.enums';
import type { User } from '../model/identity.types';

/**
 * Only ACTIVE, non-deleted users may authenticate or hold a live session.
 * INVITED/INACTIVE/SUSPENDED/LEFT and soft-deleted users are denied — the caller
 * surfaces a generic error so denial never enumerates state.
 */
export function canAuthenticate(user: User): boolean {
  return user.deletedAt === null && user.status === UserStatus.Active;
}

/** A user is eligible to receive a password-reset token only while active. */
export function canRecoverAccount(user: User): boolean {
  return canAuthenticate(user);
}
