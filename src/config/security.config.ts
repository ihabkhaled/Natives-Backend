import { registerAs } from '@nestjs/config';

import {
  DEFAULT_JWT_EXPIRES_IN_SECONDS,
  DEFAULT_JWT_SECRET,
  DEFAULT_RATE_LIMIT_MAX,
  DEFAULT_RATE_LIMIT_TTL_MS,
} from './config.constants';
import type { SecurityConfig } from './config.types';
import { parseCsv, parseInteger } from './config.utils';

export const SECURITY_CONFIG_NAMESPACE = 'security';

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
    jwtSecret: process.env['JWT_SECRET'] ?? DEFAULT_JWT_SECRET,
    jwtExpiresInSeconds: parseInteger(
      process.env['JWT_EXPIRES_IN_SECONDS'],
      DEFAULT_JWT_EXPIRES_IN_SECONDS,
    ),
  }),
);
