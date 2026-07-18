import { plainToInstance, validateSync } from '@core/validation';

import {
  INVALID_CORS_ORIGIN_MESSAGE,
  INVALID_DB_POOL_BOUNDS_MESSAGE,
  INVALID_ENV_MESSAGE_PREFIX,
  INVALID_PRODUCTION_DB_SSL_MESSAGE,
  INVALID_PRODUCTION_JWT_SECRET_MESSAGE,
} from './config.constants';
import {
  areCorsOriginsValid,
  isDatabasePoolValid,
  isProductionDatabaseSslValid,
  isProductionJwtSecretValid,
} from './config-validation.helpers';
import { EnvironmentVariablesDto } from './environment-variables.dto';

export function validateEnv(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const parsed = plainToInstance(EnvironmentVariablesDto, raw, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(parsed, { skipMissingProperties: false });
  const messages = errors.flatMap(error =>
    Object.values(error.constraints ?? {}),
  );

  if (errors.length === 0 && !areCorsOriginsValid(parsed.CORS_ORIGIN)) {
    messages.push(INVALID_CORS_ORIGIN_MESSAGE);
  }
  if (
    errors.length === 0 &&
    !isProductionJwtSecretValid(parsed.NODE_ENV, parsed.JWT_SECRET)
  ) {
    messages.push(INVALID_PRODUCTION_JWT_SECRET_MESSAGE);
  }
  if (
    errors.length === 0 &&
    !isDatabasePoolValid(parsed.DB_POOL_MIN, parsed.DB_POOL_MAX)
  ) {
    messages.push(INVALID_DB_POOL_BOUNDS_MESSAGE);
  }
  if (
    errors.length === 0 &&
    !isProductionDatabaseSslValid(parsed.NODE_ENV, parsed.DB_SSL)
  ) {
    messages.push(INVALID_PRODUCTION_DB_SSL_MESSAGE);
  }
  if (messages.length > 0) {
    throw new Error(`${INVALID_ENV_MESSAGE_PREFIX}: ${messages.join('; ')}`);
  }

  return raw;
}
