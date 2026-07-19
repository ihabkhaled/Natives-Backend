import { ApiProperty } from '@core/openapi';

/** One ranked leaderboard row — a projected total, never a stored counter. */
export class LeaderboardRowResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly membershipId: string;

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly rank: number;

  @ApiProperty()
  declare readonly badgeCount: number;
}
