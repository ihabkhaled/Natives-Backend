import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from '@core/validation';

import {
  COHORT_MAX_LENGTH,
  DATE_PATTERN,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
} from '../../model/assessments.constants';

/**
 * Request body for opening an assessment period. Dates are inclusive, date-only
 * (YYYY-MM-DD) values interpreted in the team calendar; the range and the
 * published template reference are validated before any row is written.
 */
export class CreatePeriodDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly seasonId?: string | null;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  declare readonly templateId: string;

  @ApiProperty({ maxLength: NAME_MAX_LENGTH, minLength: NAME_MIN_LENGTH })
  @IsString()
  @MinLength(NAME_MIN_LENGTH)
  @MaxLength(NAME_MAX_LENGTH)
  declare readonly name: string;

  @ApiPropertyOptional({ maxLength: COHORT_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(COHORT_MAX_LENGTH)
  readonly cohort?: string | null;

  @ApiProperty({ example: '2026-01-01' })
  @IsString()
  @Matches(DATE_PATTERN)
  declare readonly startsOn: string;

  @ApiProperty({ example: '2026-06-30' })
  @IsString()
  @Matches(DATE_PATTERN)
  declare readonly endsOn: string;
}
