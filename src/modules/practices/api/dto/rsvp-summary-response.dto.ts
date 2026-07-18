import { ApiProperty } from '@core/openapi';

/**
 * Privacy-safe planning aggregate for a session. All counts are projections from
 * the RSVP rows; `spotsRemaining` is null for an uncapped session (null-not-zero).
 */
export class RsvpSummaryResponseDto {
  @ApiProperty()
  declare readonly sessionId: string;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly capacity: number | null;

  @ApiProperty()
  declare readonly going: number;

  @ApiProperty()
  declare readonly waitlisted: number;

  @ApiProperty()
  declare readonly notGoing: number;

  @ApiProperty()
  declare readonly maybe: number;

  @ApiProperty()
  declare readonly noResponse: number;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly spotsRemaining: number | null;
}
