import { ApiProperty } from '@core/openapi';

import { MatchEventResponseDto } from './match-event-response.dto';

/** A bounded page of the append-only match stream, in sequence order. */
export class ListMatchEventsResponseDto {
  @ApiProperty({ type: [MatchEventResponseDto] })
  declare readonly items: readonly MatchEventResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
