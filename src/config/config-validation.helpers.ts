import { EmailProvider, NodeEnv } from '@shared/enums';

import {
  DEFAULT_DB_POOL_MAX,
  DEFAULT_DB_POOL_MIN,
  FLAG_TRUE,
  HTTP_PROTOCOL,
  HTTPS_PROTOCOL,
  JWT_SECRET_FORBIDDEN_FRAGMENTS,
  JWT_SECRET_FORBIDDEN_SEQUENCES,
  JWT_SECRET_MIN_LENGTH,
  JWT_SECRET_MIN_UNIQUE_CHARACTERS,
  JWT_SECRET_PRODUCTION_PATTERN,
} from './config.constants';
import { parseCsv } from './config.utils';

function isHttpOrigin(origin: string): boolean {
  if (!URL.canParse(origin)) {
    return false;
  }
  const url = new URL(origin);
  const isHttpProtocol =
    url.protocol === HTTP_PROTOCOL || url.protocol === HTTPS_PROTOCOL;
  return isHttpProtocol && url.origin === origin;
}

export function areCorsOriginsValid(value: string | undefined): boolean {
  return parseCsv(value).every(origin => isHttpOrigin(origin));
}

export function isProductionJwtSecretValid(
  nodeEnv: NodeEnv,
  secret: string | undefined,
): boolean {
  if (nodeEnv !== NodeEnv.Production) {
    return true;
  }
  if (secret === undefined || secret.length < JWT_SECRET_MIN_LENGTH) {
    return false;
  }

  const normalizedSecret = secret.toLowerCase();
  const hasForbiddenFragment = JWT_SECRET_FORBIDDEN_FRAGMENTS.some(fragment =>
    normalizedSecret.includes(fragment),
  );
  const hasSequentialPattern = JWT_SECRET_FORBIDDEN_SEQUENCES.some(sequence =>
    normalizedSecret.includes(sequence),
  );
  const uniqueCharacterCount = new Set(secret).size;
  return (
    !hasForbiddenFragment &&
    !hasSequentialPattern &&
    JWT_SECRET_PRODUCTION_PATTERN.test(secret) &&
    uniqueCharacterCount >= JWT_SECRET_MIN_UNIQUE_CHARACTERS
  );
}

export function isDatabasePoolValid(
  min: number | undefined,
  max: number | undefined,
): boolean {
  return (min ?? DEFAULT_DB_POOL_MIN) <= (max ?? DEFAULT_DB_POOL_MAX);
}

export function isProductionDatabaseSslValid(
  nodeEnv: NodeEnv,
  ssl: string | undefined,
): boolean {
  if (nodeEnv !== NodeEnv.Production) {
    return true;
  }
  return ssl === FLAG_TRUE;
}

/**
 * The full outbound-email config is required only when a real transport is
 * actually going to deliver — provider is smtp AND the master switch is on. In
 * that case FROM, TO, HOST, USER and PASS must all be present so a
 * misconfiguration fails fast at boot rather than surfacing as a runtime 503 on
 * the first send (e.g. the contact endpoint). Every other combination (console
 * provider, or smtp-but-disabled) boots without them so a fresh checkout runs.
 */
export function isSmtpConfigValid(inputs: {
  readonly provider: string | undefined;
  readonly enabled: string | undefined;
  readonly from: string | undefined;
  readonly to: string | undefined;
  readonly host: string | undefined;
  readonly user: string | undefined;
  readonly pass: string | undefined;
}): boolean {
  const selectsSmtp =
    inputs.provider?.trim().toLowerCase() === EmailProvider.Smtp &&
    inputs.enabled === FLAG_TRUE;
  if (!selectsSmtp) {
    return true;
  }
  return (
    hasText(inputs.from) &&
    hasText(inputs.to) &&
    hasText(inputs.host) &&
    hasText(inputs.user) &&
    hasText(inputs.pass)
  );
}

function hasText(value: string | undefined): boolean {
  return value !== undefined && value.trim().length > 0;
}
