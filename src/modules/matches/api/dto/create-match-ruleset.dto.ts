import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from '@core/validation';

import {
  CAP_MAX,
  CAP_MIN,
  GAME_TO_MAX,
  GAME_TO_MIN,
  KEY_MAX_LENGTH,
  KEY_MIN_LENGTH,
  MINUTES_MAX,
  MINUTES_MIN,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  NOTES_MAX_LENGTH,
  PERIODS_MAX,
  PERIODS_MIN,
  TIMEOUTS_MAX,
  TIMEOUTS_MIN,
  WIN_BY_MAX,
  WIN_BY_MIN,
} from '../../model/matches.constants';

/**
 * Request body to publish a new VERSION of a named scoring rule set. Every cap is
 * optional and stays NULL when omitted — a rule that was not configured DOES NOT
 * APPLY, and is never stored as a zero the scoring engine would act on.
 */
export class CreateMatchRulesetDto {
  @ApiProperty({ minLength: KEY_MIN_LENGTH, maxLength: KEY_MAX_LENGTH })
  @IsString()
  @MinLength(KEY_MIN_LENGTH)
  @MaxLength(KEY_MAX_LENGTH)
  declare readonly rulesetKey: string;

  @ApiProperty({ minLength: NAME_MIN_LENGTH, maxLength: NAME_MAX_LENGTH })
  @IsString()
  @MinLength(NAME_MIN_LENGTH)
  @MaxLength(NAME_MAX_LENGTH)
  declare readonly name: string;

  @ApiProperty({ minimum: GAME_TO_MIN, maximum: GAME_TO_MAX })
  @IsInt()
  @Min(GAME_TO_MIN)
  @Max(GAME_TO_MAX)
  declare readonly gameTo: number;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly seasonId?: string | null;

  @ApiPropertyOptional({
    minimum: WIN_BY_MIN,
    maximum: WIN_BY_MAX,
    default: WIN_BY_MIN,
  })
  @IsOptional()
  @IsInt()
  @Min(WIN_BY_MIN)
  @Max(WIN_BY_MAX)
  readonly winBy?: number | null;

  @ApiPropertyOptional({
    minimum: CAP_MIN,
    maximum: CAP_MAX,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(CAP_MIN)
  @Max(CAP_MAX)
  readonly hardCap?: number | null;

  @ApiPropertyOptional({
    minimum: MINUTES_MIN,
    maximum: MINUTES_MAX,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(MINUTES_MIN)
  @Max(MINUTES_MAX)
  readonly softCapMinutes?: number | null;

  @ApiPropertyOptional({ minimum: CAP_MIN, maximum: CAP_MAX, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(CAP_MIN)
  @Max(CAP_MAX)
  readonly softCapPlus?: number | null;

  @ApiPropertyOptional({
    minimum: MINUTES_MIN,
    maximum: MINUTES_MAX,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(MINUTES_MIN)
  @Max(MINUTES_MAX)
  readonly timeCapMinutes?: number | null;

  @ApiPropertyOptional({ minimum: CAP_MIN, maximum: CAP_MAX, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(CAP_MIN)
  @Max(CAP_MAX)
  readonly halftimeAt?: number | null;

  @ApiPropertyOptional({
    minimum: TIMEOUTS_MIN,
    maximum: TIMEOUTS_MAX,
    default: TIMEOUTS_MIN,
  })
  @IsOptional()
  @IsInt()
  @Min(TIMEOUTS_MIN)
  @Max(TIMEOUTS_MAX)
  readonly timeoutsPerTeam?: number | null;

  @ApiPropertyOptional({
    minimum: TIMEOUTS_MIN,
    maximum: TIMEOUTS_MAX,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(TIMEOUTS_MIN)
  @Max(TIMEOUTS_MAX)
  readonly timeoutsPerPeriod?: number | null;

  @ApiPropertyOptional({
    minimum: PERIODS_MIN,
    maximum: PERIODS_MAX,
    default: PERIODS_MIN,
  })
  @IsOptional()
  @IsInt()
  @Min(PERIODS_MIN)
  @Max(PERIODS_MAX)
  readonly periods?: number | null;

  @ApiPropertyOptional({ maxLength: NOTES_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(NOTES_MAX_LENGTH)
  readonly notes?: string | null;
}
