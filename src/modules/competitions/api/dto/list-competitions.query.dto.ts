import { ApiPropertyOptional } from '@core/openapi';
import { IsOptional, IsUUID } from '@core/validation';

import { ListQueryDto } from './list.query.dto';

/** Bounded list query for competitions, optionally narrowed to one season. */
export class ListCompetitionsQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  readonly seasonId?: string;
}
