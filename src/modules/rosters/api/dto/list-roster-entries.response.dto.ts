import { ApiProperty } from '@core/openapi';

import { CompetitionRosterEntryResponseDto } from './roster-entry-response.dto';

/**
 * A bounded page of roster entries — active AND withdrawn — so every rostered
 * player appears exactly once even when they recorded nothing.
 */
export class ListRosterEntriesResponseDto {
  @ApiProperty({ type: [CompetitionRosterEntryResponseDto] })
  declare readonly items: readonly CompetitionRosterEntryResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
