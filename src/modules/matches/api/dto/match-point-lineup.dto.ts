import { ApiProperty } from '@core/openapi';

/** One player recorded as being on the line for a point. */
export class MatchPointLineupDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly lineupId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly matchId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly playId: string;

  @ApiProperty()
  declare readonly pointNumber: number;

  @ApiProperty({ format: 'uuid' })
  declare readonly membershipId: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly rosterEntryId: string | null;

  @ApiProperty()
  declare readonly puller: boolean;
}
