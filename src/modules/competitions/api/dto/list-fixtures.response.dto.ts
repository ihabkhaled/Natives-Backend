import { ApiProperty } from '@core/openapi';

import { FixtureResponseDto } from './fixture-response.dto';

/** A bounded, chronologically ordered page of fixtures — the calendar shell. */
export class ListFixturesResponseDto {
  @ApiProperty({ type: [FixtureResponseDto] })
  declare readonly items: readonly FixtureResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
