import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from '@core/validation';

import {
  ACTIVITY_CATEGORY_MAX_LENGTH,
  ACTIVITY_CATEGORY_MIN_LENGTH,
  ENTRY_CAP_MAX,
  ENTRY_CAP_MIN,
  ENTRY_COOLDOWN_MAX,
  ENTRY_COOLDOWN_MIN,
  ENTRY_POINTS_MAX,
  ENTRY_POINTS_MIN,
} from '../../model/points.constants';

/**
 * One activity-category point entry of a rule version. A null `points` is a
 * pending/unresolved value that never awards; `dailyCap` and `cooldownDays` are
 * optional per-category limits (null = unbounded).
 */
export class PointEntryDto {
  @ApiProperty({
    minLength: ACTIVITY_CATEGORY_MIN_LENGTH,
    maxLength: ACTIVITY_CATEGORY_MAX_LENGTH,
  })
  @IsString()
  @MinLength(ACTIVITY_CATEGORY_MIN_LENGTH)
  @MaxLength(ACTIVITY_CATEGORY_MAX_LENGTH)
  declare readonly activityCategory: string;

  @ApiPropertyOptional({
    minimum: ENTRY_POINTS_MIN,
    maximum: ENTRY_POINTS_MAX,
    nullable: true,
  })
  @IsOptional()
  @IsNumber()
  @Min(ENTRY_POINTS_MIN)
  @Max(ENTRY_POINTS_MAX)
  readonly points?: number | null;

  @ApiPropertyOptional({
    minimum: ENTRY_CAP_MIN,
    maximum: ENTRY_CAP_MAX,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(ENTRY_CAP_MIN)
  @Max(ENTRY_CAP_MAX)
  readonly dailyCap?: number | null;

  @ApiPropertyOptional({
    minimum: ENTRY_COOLDOWN_MIN,
    maximum: ENTRY_COOLDOWN_MAX,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(ENTRY_COOLDOWN_MIN)
  @Max(ENTRY_COOLDOWN_MAX)
  readonly cooldownDays?: number | null;
}
