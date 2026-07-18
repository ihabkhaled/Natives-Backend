import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
  Type,
  ValidateNested,
} from '@core/validation';
import { RbacRole } from '@shared/enums';

import {
  COHORT_MAX_LENGTH,
  DEFINITION_KEY_PATTERN,
  EVALUATOR_ROLES_MAX_ITEMS,
  KEY_MAX_LENGTH,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  TEMPLATE_CATEGORIES_MAX_ITEMS,
  TEMPLATE_METRICS_MAX_ITEMS,
  VERSION_MIN,
} from '../../model/assessments.constants';
import { CategoryWeightDto } from './category-weight.dto';
import { TemplateMetricDto } from './template-metric.dto';

/**
 * Request body for creating a template or appending a new draft version. Category
 * weights must total 100 and metrics must be uniquely positioned (enforced as
 * domain rules). The referenced season, categories, and metric versions must all
 * exist within the team scope.
 */
export class CreateTemplateDto {
  @ApiProperty({ maxLength: KEY_MAX_LENGTH })
  @IsString()
  @Matches(DEFINITION_KEY_PATTERN)
  @MaxLength(KEY_MAX_LENGTH)
  declare readonly key: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly seasonId?: string | null;

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

  @ApiProperty({ enum: RbacRole, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(EVALUATOR_ROLES_MAX_ITEMS)
  @IsEnum(RbacRole, { each: true })
  declare readonly evaluatorRoles: readonly RbacRole[];

  @ApiProperty({ minimum: VERSION_MIN })
  @IsInt()
  @Min(VERSION_MIN)
  declare readonly scoreVersion: number;

  @ApiProperty({ type: [CategoryWeightDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(TEMPLATE_CATEGORIES_MAX_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => CategoryWeightDto)
  declare readonly categoryWeights: readonly CategoryWeightDto[];

  @ApiProperty({ type: [TemplateMetricDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(TEMPLATE_METRICS_MAX_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => TemplateMetricDto)
  declare readonly metrics: readonly TemplateMetricDto[];
}
