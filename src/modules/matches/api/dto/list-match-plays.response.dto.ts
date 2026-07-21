import { ApiProperty } from '@core/openapi';

import { MatchPlayResponseDto } from './match-play-response.dto';

/** A bounded page of the append-only point stream, in sequence order. */
export class ListMatchPlaysResponseDto {
  @ApiProperty({ type: [MatchPlayResponseDto] })
  declare readonly items: readonly MatchPlayResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
