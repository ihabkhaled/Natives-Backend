import { ApiProperty } from '@core/openapi';

import { DrillResponseDto } from './drill-response.dto';

/** Paginated envelope for the drill catalog list. */
export class ListDrillsResponseDto {
  @ApiProperty({ type: [DrillResponseDto] })
  declare readonly items: readonly DrillResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
