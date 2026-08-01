import { UserStatus } from '../model/identity.enums';
import type { User } from '../model/identity.types';

/**
 * A signup is reviewable only while it is still pending and not soft-deleted.
 * Approval and rejection both gate on this so a second reviewer cannot re-decide
 * an already-approved (Active) or already-rejected account, and so an ordinary
 * account can never be flipped through the review endpoints.
 */
export function isReviewableSignup(user: User): boolean {
  return user.deletedAt === null && user.status === UserStatus.Pending;
}
