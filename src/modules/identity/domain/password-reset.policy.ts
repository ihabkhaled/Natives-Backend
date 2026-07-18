import type { PasswordResetToken } from '../model/identity.types';

/**
 * A password-reset token is usable exactly once, before it expires. Consumed or
 * expired tokens are rejected with a generic error.
 */
export function isResetTokenUsable(
  token: PasswordResetToken,
  now: Date,
): boolean {
  return token.consumedAt === null && token.expiresAt.getTime() > now.getTime();
}
