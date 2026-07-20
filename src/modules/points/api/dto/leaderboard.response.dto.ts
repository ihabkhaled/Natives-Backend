import { ApiProperty } from '@core/openapi';

import {
  LeaderboardCohort,
  LeaderboardPeriod,
  LeaderboardTieMode,
} from '../../model/leaderboard.enums';
import { LeaderboardRowResponseDto } from './leaderboard-row-response.dto';

/**
 * A bounded, ranked page of the team points leaderboard. Echoes the resolved
 * scope (window, tie mode, cohort, category filter) for transparency and carries
 * the freshness instant the projection was read at.
 */
export class LeaderboardResponseDto {
  @ApiProperty({ type: [LeaderboardRowResponseDto] })
  declare readonly items: readonly LeaderboardRowResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;

  @ApiProperty({ enum: LeaderboardPeriod })
  declare readonly period: LeaderboardPeriod;

  @ApiProperty({ enum: LeaderboardTieMode })
  declare readonly tieMode: LeaderboardTieMode;

  @ApiProperty({ enum: LeaderboardCohort })
  declare readonly cohort: LeaderboardCohort;

  @ApiProperty({ type: String, nullable: true })
  declare readonly category: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly asOf: Date;
}
