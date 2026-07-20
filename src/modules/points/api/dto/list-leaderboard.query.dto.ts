import { ApiPropertyOptional } from '@core/openapi';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  Type,
} from '@core/validation';

import {
  LEADERBOARD_CATEGORY_MAX_LENGTH,
  LEADERBOARD_CATEGORY_MIN_LENGTH,
} from '../../model/leaderboard.constants';
import {
  LeaderboardCohort,
  LeaderboardPeriod,
  LeaderboardTieMode,
} from '../../model/leaderboard.enums';
import {
  LIST_DEFAULT_LIMIT,
  LIST_MAX_LIMIT,
  LIST_MIN_LIMIT,
} from '../../model/points.constants';

/**
 * Bounded, filtered query for the team leaderboard: the scored window, the
 * documented tie mode, the cohort completeness filter, an optional season
 * (required for the season window), an optional single activity-category filter,
 * and clamped pagination.
 */
export class ListLeaderboardQueryDto {
  @ApiPropertyOptional({ enum: LeaderboardPeriod })
  @IsOptional()
  @IsEnum(LeaderboardPeriod)
  readonly period?: LeaderboardPeriod;

  @ApiPropertyOptional({ enum: LeaderboardTieMode })
  @IsOptional()
  @IsEnum(LeaderboardTieMode)
  readonly tieMode?: LeaderboardTieMode;

  @ApiPropertyOptional({ enum: LeaderboardCohort })
  @IsOptional()
  @IsEnum(LeaderboardCohort)
  readonly cohort?: LeaderboardCohort;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  readonly seasonId?: string;

  @ApiPropertyOptional({
    minLength: LEADERBOARD_CATEGORY_MIN_LENGTH,
    maxLength: LEADERBOARD_CATEGORY_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MinLength(LEADERBOARD_CATEGORY_MIN_LENGTH)
  @MaxLength(LEADERBOARD_CATEGORY_MAX_LENGTH)
  readonly category?: string;

  @ApiPropertyOptional({
    minimum: LIST_MIN_LIMIT,
    maximum: LIST_MAX_LIMIT,
    default: LIST_DEFAULT_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(LIST_MIN_LIMIT)
  @Max(LIST_MAX_LIMIT)
  readonly limit?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  readonly offset?: number;
}
