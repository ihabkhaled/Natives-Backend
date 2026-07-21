import { ApiProperty } from '@core/openapi';

/**
 * Team-level derived statistics. The point figures come from the point envelope
 * and are always measured; the possession figures are `null` until possession
 * facts were actually recorded, and opponent errors stay `null` unless the
 * versioned ruleset approves attributing them.
 */
export class TeamMatchStatisticsDto {
  @ApiProperty()
  declare readonly pointsStarted: number;

  @ApiProperty()
  declare readonly pointsCompleted: number;

  @ApiProperty()
  declare readonly holds: number;

  @ApiProperty()
  declare readonly breaks: number;

  @ApiProperty()
  declare readonly opponentHolds: number;

  @ApiProperty()
  declare readonly opponentBreaks: number;

  @ApiProperty()
  declare readonly goalsFor: number;

  @ApiProperty()
  declare readonly goalsAgainst: number;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly drops: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly throwaways: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly blocks: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly turnovers: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly opponentErrors: number | null;
}
