import { LogLevel } from '@shared/enums';

export const APP_CONFIG_NAMESPACE = 'app';
export const SECURITY_CONFIG_NAMESPACE = 'security';
export const DATABASE_CONFIG_NAMESPACE = 'database';
export const IDENTITY_CONFIG_NAMESPACE = 'identity';
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

// --- Database ---------------------------------------------------------------
// Discrete connection fields are optional: the factory prefers DATABASE_URL and
// otherwise falls back to these defaults so local development boots without a
// hand-written .env. Production still fails fast on a missing/weak SSL flag.
export const DEFAULT_DB_HOST = 'localhost';
export const DEFAULT_DB_PORT = 5432;
export const DEFAULT_DB_USERNAME = 'postgres';
export const DEFAULT_DB_NAME = 'ultimate_natives';

export const DEFAULT_DB_POOL_MIN = 2;
export const DEFAULT_DB_POOL_MAX = 10;
export const MIN_DB_POOL_SIZE = 0;
export const MAX_DB_POOL_SIZE = 100;

export const DEFAULT_DB_CONNECT_TIMEOUT_MS = 10_000;
export const DEFAULT_DB_STATEMENT_TIMEOUT_MS = 15_000;
export const MIN_DB_TIMEOUT_MS = 1;
export const MAX_DB_TIMEOUT_MS = 120_000;

export const INVALID_DB_POOL_BOUNDS_MESSAGE =
  'DB_POOL_MIN must be less than or equal to DB_POOL_MAX';
export const INVALID_PRODUCTION_DB_SSL_MESSAGE =
  'DB_SSL must be true in production';

// --- Identity: token lifetimes & login throttling ---------------------------
// TTLs are seconds; instants are derived at the edge (ClockPort.now + ttl) and
// stored in UTC. Bounds keep every value sane and fail-fast on misconfiguration.
export const DEFAULT_REFRESH_TOKEN_TTL_SECONDS = 1_209_600; // 14 days
export const MIN_REFRESH_TOKEN_TTL_SECONDS = 3_600; // 1 hour
export const MAX_REFRESH_TOKEN_TTL_SECONDS = 7_776_000; // 90 days

export const DEFAULT_INVITATION_TTL_SECONDS = 604_800; // 7 days
export const MIN_INVITATION_TTL_SECONDS = 3_600; // 1 hour
export const MAX_INVITATION_TTL_SECONDS = 2_592_000; // 30 days

export const DEFAULT_PASSWORD_RESET_TTL_SECONDS = 3_600; // 1 hour
export const MIN_PASSWORD_RESET_TTL_SECONDS = 300; // 5 minutes
export const MAX_PASSWORD_RESET_TTL_SECONDS = 86_400; // 1 day

export const DEFAULT_MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const MIN_MAX_FAILED_LOGIN_ATTEMPTS = 1;
export const MAX_MAX_FAILED_LOGIN_ATTEMPTS = 100;

export const DEFAULT_FAILED_LOGIN_WINDOW_SECONDS = 900; // 15 minutes
export const MIN_FAILED_LOGIN_WINDOW_SECONDS = 1;
export const MAX_FAILED_LOGIN_WINDOW_SECONDS = 86_400;

export const DEFAULT_ACCOUNT_LOCKOUT_SECONDS = 900; // 15 minutes
export const MIN_ACCOUNT_LOCKOUT_SECONDS = 1;
export const MAX_ACCOUNT_LOCKOUT_SECONDS = 86_400;

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
