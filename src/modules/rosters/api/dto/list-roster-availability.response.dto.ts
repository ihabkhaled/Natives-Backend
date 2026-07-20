import { ApiProperty } from '@core/openapi';

import { RosterAvailabilityResponseDto } from './roster-availability-response.dto';

/** A bounded page of roster availability declarations. */
export class ListRosterAvailabilityResponseDto {
  @ApiProperty({ type: [RosterAvailabilityResponseDto] })
  declare readonly items: readonly RosterAvailabilityResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
