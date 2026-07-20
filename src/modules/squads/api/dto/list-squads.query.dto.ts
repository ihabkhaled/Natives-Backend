import { ApiPropertyOptional } from '@core/openapi';
import { IsOptional, IsUUID } from '@core/validation';

import { ListQueryDto } from './list.query.dto';

/** Bounded list query for squads, optionally narrowed to one season. */
export class ListSquadsQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  readonly seasonId?: string;
}
