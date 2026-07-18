import {
  DEFAULT_SEED_ADMIN_DISPLAY_NAME,
  DEFAULT_SEED_ADMIN_EMAIL,
  SEED_ADMIN_DISPLAY_NAME_INVALID_MESSAGE,
  SEED_ADMIN_EMAIL_INVALID_MESSAGE,
  SEED_ADMIN_EMAIL_WHITESPACE_PATTERN,
  SEED_ADMIN_PASSWORD_MAX_BYTES,
  SEED_ADMIN_PASSWORD_MIN_LENGTH,
  SEED_ADMIN_PASSWORD_REQUIRED_MESSAGE,
  SEED_ADMIN_PASSWORD_TOO_LONG_MESSAGE,
} from './config.constants';
import type { SeedAdminConfig } from './config.types';

/**
 * Load and validate the explicit administrator-seed inputs. This owner is
 * intentionally separate from ConfigModule: ordinary application startup must
 * not require bootstrap-only credentials. The password has no default and is
 * never trimmed or logged; email/display name use synthetic local defaults.
 */
export function loadSeedAdminConfig(): SeedAdminConfig {
  const email = (
    process.env['SEED_ADMIN_EMAIL'] ?? DEFAULT_SEED_ADMIN_EMAIL
  ).trim();
  const displayName = (
    process.env['SEED_ADMIN_DISPLAY_NAME'] ?? DEFAULT_SEED_ADMIN_DISPLAY_NAME
  ).trim();
  const password = process.env['SEED_ADMIN_PASSWORD'];

  if (
    password === undefined ||
    password.trim().length < SEED_ADMIN_PASSWORD_MIN_LENGTH
  ) {
    throw new Error(SEED_ADMIN_PASSWORD_REQUIRED_MESSAGE);
  }
  if (Buffer.byteLength(password, 'utf8') > SEED_ADMIN_PASSWORD_MAX_BYTES) {
    throw new Error(SEED_ADMIN_PASSWORD_TOO_LONG_MESSAGE);
  }
  if (!isValidSeedAdminEmail(email)) {
    throw new Error(SEED_ADMIN_EMAIL_INVALID_MESSAGE);
  }
  if (displayName === '') {
    throw new Error(SEED_ADMIN_DISPLAY_NAME_INVALID_MESSAGE);
  }

  return { email, password, displayName };
}

function isValidSeedAdminEmail(email: string): boolean {
  const atIndex = email.indexOf('@');
  const finalAtIndex = email.lastIndexOf('@');
  const finalDotIndex = email.lastIndexOf('.');
  return (
    atIndex > 0 &&
    atIndex === finalAtIndex &&
    finalDotIndex > atIndex + 1 &&
    finalDotIndex < email.length - 1 &&
    !SEED_ADMIN_EMAIL_WHITESPACE_PATTERN.test(email)
  );
}
