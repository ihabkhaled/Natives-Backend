import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
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
} from '@core/validation';

import {
  AGENDA_NOTES_MAX_LENGTH,
  BLOCK_TITLE_MAX_LENGTH,
  BLOCK_TITLE_MIN_LENGTH,
  COACH_NOTES_MAX_LENGTH,
  DURATION_MINUTES_MAX,
  DURATION_MINUTES_MIN,
  OFFSET_MINUTES_MAX,
  OFFSET_MINUTES_MIN,
  REPETITIONS_MAX,
  REPETITIONS_MIN,
  TARGET_MAX_LENGTH,
} from '../../model/agendas.constants';
import { AgendaBlockType, DrillIntensity } from '../../model/agendas.enums';

/**
 * Shared authoring fields for an agenda block. `coachNotes` is the PRIVATE coach-only
 * note — echoed back only on drill.manage authoring responses and never in the broad
 * agenda read. Numeric fields stay absent (null) rather than defaulting to zero.
 */
export class BlockFieldsDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  declare readonly drillId?: string;

  @ApiProperty({
    minLength: BLOCK_TITLE_MIN_LENGTH,
    maxLength: BLOCK_TITLE_MAX_LENGTH,
  })
  @IsString()
  @MinLength(BLOCK_TITLE_MIN_LENGTH)
  @MaxLength(BLOCK_TITLE_MAX_LENGTH)
  declare readonly title: string;

  @ApiPropertyOptional({ enum: AgendaBlockType })
  @IsOptional()
  @IsEnum(AgendaBlockType)
  declare readonly blockType?: AgendaBlockType;

  @ApiPropertyOptional({
    minimum: OFFSET_MINUTES_MIN,
    maximum: OFFSET_MINUTES_MAX,
  })
  @IsOptional()
  @IsInt()
  @Min(OFFSET_MINUTES_MIN)
  @Max(OFFSET_MINUTES_MAX)
  declare readonly offsetMinutes?: number;

  @ApiPropertyOptional({
    minimum: DURATION_MINUTES_MIN,
    maximum: DURATION_MINUTES_MAX,
  })
  @IsOptional()
  @IsInt()
  @Min(DURATION_MINUTES_MIN)
  @Max(DURATION_MINUTES_MAX)
  declare readonly durationMinutes?: number;

  @ApiPropertyOptional({ enum: DrillIntensity })
  @IsOptional()
  @IsEnum(DrillIntensity)
  declare readonly intensity?: DrillIntensity;

  @ApiPropertyOptional({ minimum: REPETITIONS_MIN, maximum: REPETITIONS_MAX })
  @IsOptional()
  @IsInt()
  @Min(REPETITIONS_MIN)
  @Max(REPETITIONS_MAX)
  declare readonly repetitions?: number;

  @ApiPropertyOptional({ maxLength: TARGET_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(TARGET_MAX_LENGTH)
  declare readonly target?: string;

  @ApiPropertyOptional({ maxLength: AGENDA_NOTES_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(AGENDA_NOTES_MAX_LENGTH)
  declare readonly notes?: string;

  @ApiPropertyOptional({ maxLength: COACH_NOTES_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(COACH_NOTES_MAX_LENGTH)
  declare readonly coachNotes?: string;
}
