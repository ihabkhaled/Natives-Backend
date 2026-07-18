import { InvitationStatus } from '../model/identity.enums';
import type { Invitation } from '../model/identity.types';

/**
 * An invitation may be accepted only while it is pending, unexpired, and neither
 * accepted nor revoked. Expiry is evaluated against the injected clock instant so
 * behaviour is deterministic under test.
 */
export function isInvitationAcceptable(
  invitation: Invitation,
  now: Date,
): boolean {
  return (
    invitation.status === InvitationStatus.Pending &&
    invitation.acceptedAt === null &&
    invitation.revokedAt === null &&
    invitation.expiresAt.getTime() > now.getTime()
  );
}

/** A pending invitation whose expiry has passed is stale and should be swept. */
export function isInvitationExpired(
  invitation: Invitation,
  now: Date,
): boolean {
  return (
    invitation.status === InvitationStatus.Pending &&
    invitation.expiresAt.getTime() <= now.getTime()
  );
}

/** Only pending invitations can be resent or revoked. */
export function isInvitationMutable(invitation: Invitation): boolean {
  return invitation.status === InvitationStatus.Pending;
}
