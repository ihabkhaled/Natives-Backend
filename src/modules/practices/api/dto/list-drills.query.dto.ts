import { ApiPropertyOptional } from '@core/openapi';
import { IsEnum, IsOptional, IsString, MaxLength } from '@core/validation';

import { SKILL_TAG_MAX_LENGTH } from '../../model/agendas.constants';
import { DrillCategory, DrillStatus } from '../../model/agendas.enums';
import { ListQueryDto } from './list-query.dto';

/**
 * Filter for the drill catalog list. All dimensions are optional and allowlisted;
 * absent dimensions are unfiltered. Pagination is inherited and clamped.
 */
export class ListDrillsQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: DrillCategory })
  @IsOptional()
  @IsEnum(DrillCategory)
  readonly category?: DrillCategory;

  @ApiPropertyOptional({ enum: DrillStatus })
  @IsOptional()
  @IsEnum(DrillStatus)
  readonly status?: DrillStatus;

  @ApiPropertyOptional({ maxLength: SKILL_TAG_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(SKILL_TAG_MAX_LENGTH)
  readonly skillTag?: string;
}
