import { ApiProperty } from '@core/openapi';

import { OpponentResponseDto } from './opponent-response.dto';

/** A bounded page of catalogued opponents. */
export class ListOpponentsResponseDto {
  @ApiProperty({ type: [OpponentResponseDto] })
  declare readonly items: readonly OpponentResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
