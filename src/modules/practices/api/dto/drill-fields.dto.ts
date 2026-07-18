import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from '@core/validation';

import {
  DRILL_NAME_MAX_LENGTH,
  DRILL_NAME_MIN_LENGTH,
  DURATION_MINUTES_MAX,
  DURATION_MINUTES_MIN,
  EQUIPMENT_ITEM_MAX_LENGTH,
  EQUIPMENT_MAX_COUNT,
  INSTRUCTIONS_MAX_LENGTH,
  MEDIA_URL_MAX_LENGTH,
  OBJECTIVE_MAX_LENGTH,
  SAFETY_MAX_LENGTH,
  SKILL_TAG_MAX_LENGTH,
  SKILL_TAGS_MAX_COUNT,
} from '../../model/agendas.constants';
import { DrillCategory, DrillIntensity } from '../../model/agendas.enums';

/**
 * Shared authoring fields for a catalog drill. Optional fields stay absent (mapped
 * to null in the command) rather than defaulted — null-not-zero for the duration.
 */
export class DrillFieldsDto {
  @ApiProperty({
    minLength: DRILL_NAME_MIN_LENGTH,
    maxLength: DRILL_NAME_MAX_LENGTH,
  })
  @IsString()
  @MinLength(DRILL_NAME_MIN_LENGTH)
  @MaxLength(DRILL_NAME_MAX_LENGTH)
  declare readonly name: string;

  @ApiProperty({ enum: DrillCategory })
  @IsEnum(DrillCategory)
  declare readonly category: DrillCategory;

  @ApiPropertyOptional({ maxLength: OBJECTIVE_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(OBJECTIVE_MAX_LENGTH)
  declare readonly objective?: string;

  @ApiPropertyOptional({ maxLength: INSTRUCTIONS_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(INSTRUCTIONS_MAX_LENGTH)
  declare readonly instructions?: string;

  @ApiPropertyOptional({ type: [String], maxItems: EQUIPMENT_MAX_COUNT })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(EQUIPMENT_MAX_COUNT)
  @IsString({ each: true })
  @MaxLength(EQUIPMENT_ITEM_MAX_LENGTH, { each: true })
  declare readonly equipment?: string[];

  @ApiPropertyOptional({ enum: DrillIntensity })
  @IsOptional()
  @IsEnum(DrillIntensity)
  declare readonly intensity?: DrillIntensity;

  @ApiPropertyOptional({
    minimum: DURATION_MINUTES_MIN,
    maximum: DURATION_MINUTES_MAX,
  })
  @IsOptional()
  @IsInt()
  @Min(DURATION_MINUTES_MIN)
  @Max(DURATION_MINUTES_MAX)
  declare readonly defaultDurationMinutes?: number;

  @ApiPropertyOptional({ type: [String], maxItems: SKILL_TAGS_MAX_COUNT })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(SKILL_TAGS_MAX_COUNT)
  @IsString({ each: true })
  @MaxLength(SKILL_TAG_MAX_LENGTH, { each: true })
  declare readonly skillTags?: string[];

  @ApiPropertyOptional({ maxLength: SAFETY_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(SAFETY_MAX_LENGTH)
  declare readonly safetyNotes?: string;

  @ApiPropertyOptional({ maxLength: MEDIA_URL_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(MEDIA_URL_MAX_LENGTH)
  declare readonly mediaUrl?: string;
}
