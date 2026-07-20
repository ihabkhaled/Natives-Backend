import { ApiProperty } from '@core/openapi';

import { RankMovement } from '../../model/leaderboard.enums';
import { CategoryContributionResponseDto } from './category-contribution-response.dto';

/**
 * One ranked leaderboard row — a projected total (never a stored counter) with a
 * transparent rank, the previous-period rank and signed movement, the badge count,
 * and the per-category explanation of how the total was reached.
 */
export class LeaderboardRowResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly membershipId: string;

  @ApiProperty()
  declare readonly status: string;

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly rank: number;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly previousRank: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly rankDelta: number | null;

  @ApiProperty({ enum: RankMovement })
  declare readonly movement: RankMovement;

  @ApiProperty()
  declare readonly badgeCount: number;

  @ApiProperty({ type: [CategoryContributionResponseDto] })
  declare readonly contributions: readonly CategoryContributionResponseDto[];
}
