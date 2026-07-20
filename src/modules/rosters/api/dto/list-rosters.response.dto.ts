import { ApiProperty } from '@core/openapi';

import { RosterResponseDto } from './roster-response.dto';

/** A bounded page of competition and match rosters. */
export class ListRostersResponseDto {
  @ApiProperty({ type: [RosterResponseDto] })
  declare readonly items: readonly RosterResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
