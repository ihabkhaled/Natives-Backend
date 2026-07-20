import { ApiProperty } from '@core/openapi';

import { SquadResponseDto } from './squad-response.dto';

/** A bounded page of squads. */
export class ListSquadsResponseDto {
  @ApiProperty({ type: [SquadResponseDto] })
  declare readonly items: readonly SquadResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
