import { LogLevel } from '@shared/enums';

export const APP_CONFIG_NAMESPACE = 'app';
export const SECURITY_CONFIG_NAMESPACE = 'security';
export const NODE_ENV_CONFIG_NAME = 'NODE_ENV';

export const DEFAULT_PORT = 3000;
export const MIN_PORT = 1;
export const MAX_PORT = 65535;

export const DEFAULT_APP_NAME = 'iron-nest';
export const DEFAULT_GLOBAL_PREFIX = 'api';
export const DEFAULT_LOG_LEVEL = LogLevel.Info;
export const MIN_CONFIG_TEXT_LENGTH = 1;

export const DEFAULT_RATE_LIMIT_TTL_MS = 60_000;
export const DEFAULT_RATE_LIMIT_MAX = 100;
export const MIN_RATE_LIMIT_TTL_MS = 1;
export const MIN_RATE_LIMIT_MAX = 1;
export const MAX_RATE_LIMIT_TTL_MS = 3_600_000;
export const MAX_RATE_LIMIT_MAX = 10_000;

export const DEFAULT_JWT_EXPIRES_IN_SECONDS = 1_800;
export const MIN_JWT_EXPIRES_IN_SECONDS = 900;
export const MAX_JWT_EXPIRES_IN_SECONDS = 1_800;
export const JWT_SECRET_MIN_LENGTH = 32;
export const JWT_SECRET_MIN_UNIQUE_CHARACTERS = 12;
export const JWT_SECRET_CONFIG_NAME = 'JWT_SECRET';
export const JWT_SECRET_FORBIDDEN_FRAGMENTS: readonly string[] = [
  'change-me',
  'unsafe',
  'example',
  'default',
  'secret',
];
export const JWT_SECRET_FORBIDDEN_SEQUENCES: readonly string[] = [
  'abcdefghijklmnopqrstuvwxyz',
  '0123456789',
  '9876543210',
];
export const JWT_SECRET_PRODUCTION_PATTERN = /^[A-Za-z0-9_-]{43,}$/u;
export const HTTP_PROTOCOL = 'http:';
export const HTTPS_PROTOCOL = 'https:';

export const FLAG_TRUE = 'true';
export const FLAG_FALSE = 'false';
export const BOOLEAN_FLAG_VALUES: readonly string[] = [FLAG_TRUE, FLAG_FALSE];

export const GLOBAL_PREFIX_PATTERN = /^[a-z0-9-]+$/u;
export const INVALID_ENV_MESSAGE_PREFIX = 'Invalid environment configuration';
export const INVALID_BOOLEAN_CONFIG_MESSAGE =
  'Invalid boolean configuration value';
export const REQUIRED_CONFIG_MISSING_MESSAGE =
  'Required configuration value is missing';
export const INVALID_NODE_ENV_MESSAGE = 'NODE_ENV is invalid';
export const INVALID_CORS_ORIGIN_MESSAGE =
  'CORS_ORIGIN must contain only absolute HTTP(S) origins';
export const INVALID_PRODUCTION_JWT_SECRET_MESSAGE =
  'JWT_SECRET must meet the configured production strength policy';
