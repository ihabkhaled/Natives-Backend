import type { RefreshSession } from '../model/identity.types';

/**
 * A refresh session is live only while it has not been rotated, revoked, or
 * flagged for reuse, and has not expired. Presenting the token of a live session
 * is the only valid refresh.
 */
export function isSessionActive(session: RefreshSession, now: Date): boolean {
  return (
    session.rotatedAt === null &&
    session.revokedAt === null &&
    session.reuseDetectedAt === null &&
    session.expiresAt.getTime() > now.getTime()
  );
}

/**
 * A session row that exists but is no longer active (already rotated or revoked)
 * being presented again is refresh-token reuse — the whole token family must be
 * revoked.
 */
export function isSessionReuse(session: RefreshSession): boolean {
  return session.rotatedAt !== null || session.revokedAt !== null;
}
