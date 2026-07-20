import { ApiProperty } from '@core/openapi';

import { MatchResponseDto } from './match-response.dto';

/** A bounded page of matches. */
export class ListMatchesResponseDto {
  @ApiProperty({ type: [MatchResponseDto] })
  declare readonly items: readonly MatchResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
