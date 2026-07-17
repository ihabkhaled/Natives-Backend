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
  MAX_JWT_EXPIRES_IN_SECONDS,
  MAX_PORT,
  MAX_RATE_LIMIT_MAX,
  MAX_RATE_LIMIT_TTL_MS,
  MIN_CONFIG_TEXT_LENGTH,
  MIN_JWT_EXPIRES_IN_SECONDS,
  MIN_PORT,
  MIN_RATE_LIMIT_MAX,
  MIN_RATE_LIMIT_TTL_MS,
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
}
