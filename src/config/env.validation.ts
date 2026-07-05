import { NodeEnv } from '@shared/enums';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
  validateSync,
} from 'class-validator';

import { MAX_PORT, MIN_PORT } from './config.constants';

class EnvironmentVariables {
  @IsOptional()
  @IsEnum(NodeEnv)
  readonly NODE_ENV?: NodeEnv;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_PORT)
  @Max(MAX_PORT)
  readonly PORT?: number;
}

export function validateEnv(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const parsed = plainToInstance(EnvironmentVariables, raw, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(parsed, { skipMissingProperties: false });

  if (errors.length > 0) {
    const messages = errors.flatMap(error =>
      Object.values(error.constraints ?? {}),
    );
    throw new Error(
      `Invalid environment configuration: ${messages.join('; ')}`,
    );
  }

  return raw;
}
