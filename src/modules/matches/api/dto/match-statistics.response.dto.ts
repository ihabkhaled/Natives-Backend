import { ApiProperty } from '@core/openapi';

import { PlayerMatchStatisticsDto } from './player-match-statistics.dto';
import { TeamMatchStatisticsDto } from './team-match-statistics.dto';

/**
 * The derived match statistics. Nothing here is a stored total: every figure is
 * re-folded from the append-only point stream, the lineups attached to it, the
 * match roster, and the VERSIONED ruleset on every read, and the projection
 * cites `rulesetKey`/`rulesetVersion`/`statsEngineVersion` so any displayed
 * number can be explained and re-derived rather than merely trusted.
 *
 * `lineupsRecorded` and `playsRecorded` say WHY a figure is null: they are the
 * difference between "nobody tracked this match" and "this player did nothing".
 */
export class MatchStatisticsResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly matchId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty()
  declare readonly rulesetKey: string;

  @ApiProperty()
  declare readonly rulesetVersion: number;

  @ApiProperty()
  declare readonly statsEngineVersion: string;

  @ApiProperty()
  declare readonly lineupsRecorded: boolean;

  @ApiProperty()
  declare readonly playsRecorded: boolean;

  @ApiProperty()
  declare readonly opponentErrorAttribution: boolean;

  @ApiProperty({ type: TeamMatchStatisticsDto })
  declare readonly team: TeamMatchStatisticsDto;

  @ApiProperty({ type: [PlayerMatchStatisticsDto] })
  declare readonly players: readonly PlayerMatchStatisticsDto[];
}
