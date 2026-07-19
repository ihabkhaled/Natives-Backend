import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  Type,
  ValidateNested,
} from '@core/validation';

import {
  ISO_DATE_PATTERN,
  RULE_DESCRIPTION_MAX_LENGTH,
  RULE_ENTRIES_MAX_ITEMS,
  RULE_KEY_MAX_LENGTH,
  RULE_KEY_MIN_LENGTH,
  RULE_NAME_MAX_LENGTH,
  RULE_NAME_MIN_LENGTH,
} from '../../model/points.constants';
import { PointEntryDto } from './point-entry.dto';

/**
 * Request body for creating a DRAFT points-rule version. Each entry maps an
 * activity category to a candidate value with optional cap/cooldown. A new rule is
 * never effective — an administrator must approve then publish it.
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

  @ApiProperty({ type: [PointEntryDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(RULE_ENTRIES_MAX_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => PointEntryDto)
  declare readonly pointEntries: readonly PointEntryDto[];
}
