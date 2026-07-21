import { ApiPropertyOptional } from '@core/openapi';
import { IsOptional, IsUUID } from '@core/validation';

import { SquadListQueryDto } from './list.query.dto';

/** Bounded list query for squads, optionally narrowed to one season. */
export class ListSquadsQueryDto extends SquadListQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  readonly seasonId?: string;
}
