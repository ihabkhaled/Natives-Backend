import { ApiProperty } from '@core/openapi';

/**
 * One player's derived statistics for a match.
 *
 * EVERY figure is nullable on purpose. `null` means NOT MEASURED — no lineups
 * were recorded, no possession facts were recorded, or the ruleset does not
 * approve opponent-error attribution — while `0` is a MEASURED zero for a
 * rostered player who was in the data and simply did not register that action.
 * A rostered player is never omitted from this list.
 */
export class PlayerMatchStatisticsDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly membershipId: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly rosterEntryId: string | null;

  @ApiProperty()
  declare readonly rostered: boolean;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly pointsPlayed: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly offencePointsPlayed: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly defencePointsPlayed: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly goals: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly assists: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly callahans: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly drops: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly throwaways: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly blocks: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly opponentErrorsForced: number | null;
}
