import { ApiProperty } from '@core/openapi';

import { MatchRevisionResponseDto } from './match-revision-response.dto';

/** A bounded page of the immutable correction trail. */
export class ListMatchRevisionsResponseDto {
  @ApiProperty({ type: [MatchRevisionResponseDto] })
  declare readonly items: readonly MatchRevisionResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
