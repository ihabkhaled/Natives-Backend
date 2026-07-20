import { ApiProperty } from '@core/openapi';

import { RosterEntryResponseDto } from './roster-entry-response.dto';

/**
 * A bounded page of roster entries — active AND withdrawn — so every rostered
 * player appears exactly once even when they recorded nothing.
 */
export class ListRosterEntriesResponseDto {
  @ApiProperty({ type: [RosterEntryResponseDto] })
  declare readonly items: readonly RosterEntryResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
