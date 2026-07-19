import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  Type,
} from '@core/validation';
import { LogLevel, NodeEnv } from '@shared/enums';

import {
  BOOLEAN_FLAG_VALUES,
  GLOBAL_PREFIX_PATTERN,
  JWT_SECRET_MIN_LENGTH,
  MAX_ACCOUNT_LOCKOUT_SECONDS,
  MAX_DB_POOL_SIZE,
  MAX_DB_TIMEOUT_MS,
  MAX_FAILED_LOGIN_WINDOW_SECONDS,
  MAX_INVITATION_TTL_SECONDS,
  MAX_JWT_EXPIRES_IN_SECONDS,
  MAX_MAX_FAILED_LOGIN_ATTEMPTS,
  MAX_PASSWORD_RESET_TTL_SECONDS,
  MAX_PORT,
  MAX_RATE_LIMIT_MAX,
  MAX_RATE_LIMIT_TTL_MS,
  MAX_REFRESH_TOKEN_TTL_SECONDS,
  MIN_ACCOUNT_LOCKOUT_SECONDS,
  MIN_CONFIG_TEXT_LENGTH,
  MIN_DB_POOL_SIZE,
  MIN_DB_TIMEOUT_MS,
  MIN_FAILED_LOGIN_WINDOW_SECONDS,
  MIN_INVITATION_TTL_SECONDS,
  MIN_JWT_EXPIRES_IN_SECONDS,
  MIN_MAX_FAILED_LOGIN_ATTEMPTS,
  MIN_PASSWORD_RESET_TTL_SECONDS,
  MIN_PORT,
  MIN_RATE_LIMIT_MAX,
  MIN_RATE_LIMIT_TTL_MS,
  MIN_REFRESH_TOKEN_TTL_SECONDS,
} from './config.constants';

export class EnvironmentVariablesDto {
  @IsEnum(NodeEnv)
  declare readonly NODE_ENV: NodeEnv;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_PORT)
  @Max(MAX_PORT)
  declare readonly PORT?: number;

  @IsOptional()
  @IsString()
  @MinLength(MIN_CONFIG_TEXT_LENGTH)
  declare readonly APP_NAME?: string;

  @IsOptional()
  @IsString()
  @Matches(GLOBAL_PREFIX_PATTERN)
  declare readonly GLOBAL_PREFIX?: string;

  @IsOptional()
  @IsIn(BOOLEAN_FLAG_VALUES)
  declare readonly ENABLE_SWAGGER?: string;

  @IsOptional()
  @IsEnum(LogLevel)
  declare readonly LOG_LEVEL?: LogLevel;

  @IsOptional()
  @IsString()
  declare readonly CORS_ORIGIN?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_RATE_LIMIT_TTL_MS)
  @Max(MAX_RATE_LIMIT_TTL_MS)
  declare readonly RATE_LIMIT_TTL_MS?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_RATE_LIMIT_MAX)
  @Max(MAX_RATE_LIMIT_MAX)
  declare readonly RATE_LIMIT_MAX?: number;

  @IsString()
  @MinLength(JWT_SECRET_MIN_LENGTH)
  declare readonly JWT_SECRET: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_JWT_EXPIRES_IN_SECONDS)
  @Max(MAX_JWT_EXPIRES_IN_SECONDS)
  declare readonly JWT_EXPIRES_IN_SECONDS?: number;

  @IsOptional()
  @IsString()
  declare readonly DATABASE_URL?: string;

  @IsOptional()
  @IsString()
  @MinLength(MIN_CONFIG_TEXT_LENGTH)
  declare readonly DB_HOST?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_PORT)
  @Max(MAX_PORT)
  declare readonly DB_PORT?: number;

  @IsOptional()
  @IsString()
  @MinLength(MIN_CONFIG_TEXT_LENGTH)
  declare readonly DB_USERNAME?: string;

  @IsOptional()
  @IsString()
  declare readonly DB_PASSWORD?: string;

  @IsOptional()
  @IsString()
  @MinLength(MIN_CONFIG_TEXT_LENGTH)
  declare readonly DB_NAME?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_DB_POOL_SIZE)
  @Max(MAX_DB_POOL_SIZE)
  declare readonly DB_POOL_MIN?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_DB_POOL_SIZE)
  @Max(MAX_DB_POOL_SIZE)
  declare readonly DB_POOL_MAX?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_DB_TIMEOUT_MS)
  @Max(MAX_DB_TIMEOUT_MS)
  declare readonly DB_CONNECT_TIMEOUT_MS?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_DB_TIMEOUT_MS)
  @Max(MAX_DB_TIMEOUT_MS)
  declare readonly DB_STATEMENT_TIMEOUT_MS?: number;

  @IsOptional()
  @IsIn(BOOLEAN_FLAG_VALUES)
  declare readonly DB_SSL?: string;

  @IsOptional()
  @IsIn(BOOLEAN_FLAG_VALUES)
  declare readonly DB_LOGGING?: string;

  @IsOptional()
  @IsIn(BOOLEAN_FLAG_VALUES)
  declare readonly DB_MIGRATIONS_RUN_ON_START?: string;

  @IsOptional()
  @IsIn(BOOLEAN_FLAG_VALUES)
  declare readonly DB_SEED_ON_START?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_REFRESH_TOKEN_TTL_SECONDS)
  @Max(MAX_REFRESH_TOKEN_TTL_SECONDS)
  declare readonly IDENTITY_REFRESH_TOKEN_TTL_SECONDS?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_INVITATION_TTL_SECONDS)
  @Max(MAX_INVITATION_TTL_SECONDS)
  declare readonly IDENTITY_INVITATION_TTL_SECONDS?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_PASSWORD_RESET_TTL_SECONDS)
  @Max(MAX_PASSWORD_RESET_TTL_SECONDS)
  declare readonly IDENTITY_PASSWORD_RESET_TTL_SECONDS?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_MAX_FAILED_LOGIN_ATTEMPTS)
  @Max(MAX_MAX_FAILED_LOGIN_ATTEMPTS)
  declare readonly IDENTITY_MAX_FAILED_LOGIN_ATTEMPTS?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_FAILED_LOGIN_WINDOW_SECONDS)
  @Max(MAX_FAILED_LOGIN_WINDOW_SECONDS)
  declare readonly IDENTITY_FAILED_LOGIN_WINDOW_SECONDS?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_ACCOUNT_LOCKOUT_SECONDS)
  @Max(MAX_ACCOUNT_LOCKOUT_SECONDS)
  declare readonly IDENTITY_ACCOUNT_LOCKOUT_SECONDS?: number;
}
