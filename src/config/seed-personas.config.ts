import { NodeEnv } from '@shared/enums';

import {
  DEFAULT_SEED_PERSONA_PASSWORD,
  SEED_PERSONA_PASSWORD_MAX_BYTES,
  SEED_PERSONA_PASSWORD_MIN_LENGTH,
  SEED_PERSONA_PASSWORD_REQUIRED_MESSAGE,
  SEED_PERSONA_PASSWORD_TOO_LONG_MESSAGE,
} from './config.constants';
import type { SeedPersonasConfig } from './config.types';

/**
 * Load and validate the demonstration-persona seed credential. Like the
 * administrator loader this owner sits outside ConfigModule: ordinary startup
 * must not require bootstrap-only credentials, and the value is read lazily only
 * on the first-time fresh database where the seeder actually runs.
 *
 * A synthetic default is permitted OUTSIDE production so a developer gets a
 * demonstrable cast of logins with zero setup; in production the value must be
 * supplied explicitly or the seed fails fast. The password is never trimmed,
 * never logged, and never hardcoded into a seeder definition (so rotating it is
 * not a checksum change).
 */
export function loadSeedPersonasConfig(): SeedPersonasConfig {
  const configured = process.env['SEED_PERSONA_PASSWORD'];
  const production = process.env['NODE_ENV'] === NodeEnv.Production;
  const password =
    configured ?? (production ? undefined : DEFAULT_SEED_PERSONA_PASSWORD);

  if (
    password === undefined ||
    password.trim().length < SEED_PERSONA_PASSWORD_MIN_LENGTH
  ) {
    throw new Error(SEED_PERSONA_PASSWORD_REQUIRED_MESSAGE);
  }
  if (Buffer.byteLength(password, 'utf8') > SEED_PERSONA_PASSWORD_MAX_BYTES) {
    throw new Error(SEED_PERSONA_PASSWORD_TOO_LONG_MESSAGE);
  }

  return { password };
}
