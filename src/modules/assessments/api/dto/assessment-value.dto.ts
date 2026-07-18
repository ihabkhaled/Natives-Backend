import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from '@core/validation';

import {
  CONFIDENCE_MAX,
  CONFIDENCE_MIN,
  NOTE_MAX_LENGTH,
  NUMERIC_VALUE_MAX,
  NUMERIC_VALUE_MIN,
  OBSERVATION_MAX,
  OBSERVATION_MIN,
  TEXT_VALUE_MAX_LENGTH,
} from '../../model/player-assessments.constants';

/**
 * A single per-metric observation. `numericValue`/`textValue` are omitted or null
 * when a metric was not evaluated (null-not-zero); a stored value is never
 * inferred from absence. `note` is a private evaluator observation.
 */
export class AssessmentValueDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  declare readonly metricDefinitionId: string;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(NUMERIC_VALUE_MIN)
  @Max(NUMERIC_VALUE_MAX)
  readonly numericValue?: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(TEXT_VALUE_MAX_LENGTH)
  readonly textValue?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(NOTE_MAX_LENGTH)
  readonly note?: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(CONFIDENCE_MIN)
  @Max(CONFIDENCE_MAX)
  readonly confidence?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(OBSERVATION_MIN)
  @Max(OBSERVATION_MAX)
  readonly observationCount?: number | null;
}
