import { ApiProperty } from '@core/openapi';

import { LeaderboardRowResponseDto } from './leaderboard-row-response.dto';

/** A bounded, ranked page of the team points leaderboard. */
export class LeaderboardResponseDto {
  @ApiProperty({ type: [LeaderboardRowResponseDto] })
  declare readonly items: readonly LeaderboardRowResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
