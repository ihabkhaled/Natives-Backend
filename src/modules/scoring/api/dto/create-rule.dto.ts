import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  Type,
  ValidateNested,
} from '@core/validation';

import {
  ISO_DATE_PATTERN,
  MIN_COMPONENTS_FLOOR,
  RULE_COMPONENTS_MAX_ITEMS,
  RULE_DESCRIPTION_MAX_LENGTH,
  RULE_KEY_MAX_LENGTH,
  RULE_KEY_MIN_LENGTH,
  RULE_NAME_MAX_LENGTH,
  RULE_NAME_MIN_LENGTH,
  SCALE_MAX_CEILING,
  SCALE_MIN_FLOOR,
} from '../../model/scoring.constants';
import { RuleComponentDto } from './rule-component.dto';

/**
 * Request body for creating a DRAFT calculation-rule version. Scale and minimum-
 * components bounds default to the legacy 0–5 configuration when omitted. Domain
 * rules further enforce unique categories and a valid effective window.
 */
export class CreateRuleDto {
  @ApiProperty({
    minLength: RULE_KEY_MIN_LENGTH,
    maxLength: RULE_KEY_MAX_LENGTH,
  })
  @IsString()
  @MinLength(RULE_KEY_MIN_LENGTH)
  @MaxLength(RULE_KEY_MAX_LENGTH)
  declare readonly ruleKey: string;

  @ApiProperty({
    minLength: RULE_NAME_MIN_LENGTH,
    maxLength: RULE_NAME_MAX_LENGTH,
  })
  @IsString()
  @MinLength(RULE_NAME_MIN_LENGTH)
  @MaxLength(RULE_NAME_MAX_LENGTH)
  declare readonly name: string;

  @ApiPropertyOptional({
    maxLength: RULE_DESCRIPTION_MAX_LENGTH,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(RULE_DESCRIPTION_MAX_LENGTH)
  readonly description?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly seasonId?: string | null;

  @ApiPropertyOptional({ minimum: SCALE_MIN_FLOOR, maximum: SCALE_MAX_CEILING })
  @IsOptional()
  @IsNumber()
  @Min(SCALE_MIN_FLOOR)
  @Max(SCALE_MAX_CEILING)
  readonly scaleMin?: number;

  @ApiPropertyOptional({ minimum: SCALE_MIN_FLOOR, maximum: SCALE_MAX_CEILING })
  @IsOptional()
  @IsNumber()
  @Min(SCALE_MIN_FLOOR)
  @Max(SCALE_MAX_CEILING)
  readonly scaleMax?: number;

  @ApiPropertyOptional({ minimum: MIN_COMPONENTS_FLOOR })
  @IsOptional()
  @IsInt()
  @Min(MIN_COMPONENTS_FLOOR)
  readonly minComponents?: number;

  @ApiPropertyOptional({ pattern: ISO_DATE_PATTERN.source, nullable: true })
  @IsOptional()
  @IsString()
  @Matches(ISO_DATE_PATTERN)
  readonly effectiveFrom?: string | null;

  @ApiPropertyOptional({ pattern: ISO_DATE_PATTERN.source, nullable: true })
  @IsOptional()
  @IsString()
  @Matches(ISO_DATE_PATTERN)
  readonly effectiveTo?: string | null;

  @ApiProperty({ type: [RuleComponentDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(RULE_COMPONENTS_MAX_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => RuleComponentDto)
  declare readonly components: readonly RuleComponentDto[];
}
