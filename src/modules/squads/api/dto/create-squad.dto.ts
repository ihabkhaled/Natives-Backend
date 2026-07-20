import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsDateString,
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
  ATTENDANCE_THRESHOLD_MAX,
  ATTENDANCE_THRESHOLD_MIN,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  NOTES_MAX_LENGTH,
} from '../../model/squads.constants';

/**
 * Request body for creating a DRAFT squad for a team + season (and optional
 * competition). The attendance threshold is a percentage used only to compute an
 * ADVISORY signal — it never gates selection; the legacy 70% is the candidate
 * default when omitted.
 */
export class CreateSquadDto {
  @ApiProperty({ minLength: NAME_MIN_LENGTH, maxLength: NAME_MAX_LENGTH })
  @IsString()
  @MinLength(NAME_MIN_LENGTH)
  @MaxLength(NAME_MAX_LENGTH)
  declare readonly name: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  declare readonly seasonId: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly competitionId?: string | null;

  @ApiPropertyOptional({
    minimum: ATTENDANCE_THRESHOLD_MIN,
    maximum: ATTENDANCE_THRESHOLD_MAX,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(ATTENDANCE_THRESHOLD_MIN)
  @Max(ATTENDANCE_THRESHOLD_MAX)
  readonly attendanceThresholdPct?: number | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional()
  @IsDateString()
  readonly selectionDeadline?: string | null;

  @ApiPropertyOptional({ maxLength: NOTES_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(NOTES_MAX_LENGTH)
  readonly notes?: string | null;
}
