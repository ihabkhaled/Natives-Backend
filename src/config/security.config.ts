import { registerAs } from '@nestjs/config';

import {
  DEFAULT_JWT_EXPIRES_IN_SECONDS,
  DEFAULT_RATE_LIMIT_MAX,
  DEFAULT_RATE_LIMIT_TTL_MS,
  JWT_SECRET_CONFIG_NAME,
  SECURITY_CONFIG_NAMESPACE,
} from './config.constants';
import type { SecurityConfig } from './config.types';
import { parseCsv, parseInteger, requireConfigValue } from './config.utils';

export const securityConfig = registerAs(
  SECURITY_CONFIG_NAMESPACE,
  (): SecurityConfig => ({
    corsOrigins: parseCsv(process.env['CORS_ORIGIN']),
    rateLimitTtlMs: parseInteger(
      process.env['RATE_LIMIT_TTL_MS'],
      DEFAULT_RATE_LIMIT_TTL_MS,
    ),
    rateLimitMax: parseInteger(
      process.env['RATE_LIMIT_MAX'],
      DEFAULT_RATE_LIMIT_MAX,
    ),
    jwtSecret: requireConfigValue(
      process.env['JWT_SECRET'],
      JWT_SECRET_CONFIG_NAME,
    ),
    jwtExpiresInSeconds: parseInteger(
      process.env['JWT_EXPIRES_IN_SECONDS'],
      DEFAULT_JWT_EXPIRES_IN_SECONDS,
    ),
  }),
);
