import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from '@core/validation';

import {
  APPLICABILITY_MAX_ITEMS,
  DEFINITION_KEY_PATTERN,
  GUIDANCE_MAX_LENGTH,
  KEY_MAX_LENGTH,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  TAG_MAX_LENGTH,
  TAGS_MAX_ITEMS,
} from '../../model/assessments.constants';
import { AssessmentDirection } from '../../model/assessments.enums';

/**
 * Request body for creating a metric definition or appending a new version. The
 * key is a stable lower_snake_case identifier; direction and the referenced scale
 * make units explicit. Unknown observations are recorded as null by the scale,
 * never coerced to zero.
 */
export class CreateMetricDto {
  @ApiProperty({ maxLength: KEY_MAX_LENGTH })
  @IsString()
  @Matches(DEFINITION_KEY_PATTERN)
  @MaxLength(KEY_MAX_LENGTH)
  declare readonly key: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  declare readonly categoryId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  declare readonly scaleId: string;

  @ApiProperty({ maxLength: NAME_MAX_LENGTH, minLength: NAME_MIN_LENGTH })
  @IsString()
  @MinLength(NAME_MIN_LENGTH)
  @MaxLength(NAME_MAX_LENGTH)
  declare readonly name: string;

  @ApiProperty({ maxLength: GUIDANCE_MAX_LENGTH, minLength: NAME_MIN_LENGTH })
  @IsString()
  @MinLength(NAME_MIN_LENGTH)
  @MaxLength(GUIDANCE_MAX_LENGTH)
  declare readonly definition: string;

  @ApiProperty({ enum: AssessmentDirection })
  @IsEnum(AssessmentDirection)
  declare readonly direction: AssessmentDirection;

  @ApiProperty({ maxLength: GUIDANCE_MAX_LENGTH, minLength: NAME_MIN_LENGTH })
  @IsString()
  @MinLength(NAME_MIN_LENGTH)
  @MaxLength(GUIDANCE_MAX_LENGTH)
  declare readonly guidance: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(APPLICABILITY_MAX_ITEMS)
  @IsString({ each: true })
  @MaxLength(TAG_MAX_LENGTH, { each: true })
  readonly applicability?: readonly string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(TAGS_MAX_ITEMS)
  @IsString({ each: true })
  @MaxLength(TAG_MAX_LENGTH, { each: true })
  readonly tags?: readonly string[];
}
