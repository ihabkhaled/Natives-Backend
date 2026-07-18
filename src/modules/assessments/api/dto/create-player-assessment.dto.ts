import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Type,
  ValidateNested,
} from '@core/validation';

import {
  METRIC_VALUES_MAX_ITEMS,
  SUMMARY_MAX_LENGTH,
} from '../../model/player-assessments.constants';
import { AssessmentValueDto } from './assessment-value.dto';

/**
 * Request body to create a DRAFT player assessment against a published template
 * and active period. Initial values are optional; each must reference a template
 * metric and stay within its scale bounds.
 */
export class CreatePlayerAssessmentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  declare readonly periodId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  declare readonly membershipId: string;

  @ApiPropertyOptional({ maxLength: SUMMARY_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(SUMMARY_MAX_LENGTH)
  readonly summary?: string | null;

  @ApiPropertyOptional({ type: [AssessmentValueDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(METRIC_VALUES_MAX_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => AssessmentValueDto)
  readonly values?: readonly AssessmentValueDto[];
}
