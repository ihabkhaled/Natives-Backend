import { ApiProperty } from '@core/openapi';

import { SelectionResponseDto } from './selection-response.dto';

/** A bounded page of squad selections (active and removed, for history). */
export class ListSelectionsResponseDto {
  @ApiProperty({ type: [SelectionResponseDto] })
  declare readonly items: readonly SelectionResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
