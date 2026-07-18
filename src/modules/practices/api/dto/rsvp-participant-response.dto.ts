import { ApiProperty } from '@core/openapi';

import { RsvpSource, RsvpStatus } from '../../model/rsvp.enums';

/**
 * One privacy-safe participant row for the team-readable list. Deliberately omits
 * the free-text note and reason category — those are coach-restricted (history).
 */
export class RsvpParticipantResponseDto {
  @ApiProperty()
  declare readonly membershipId: string;

  @ApiProperty({ enum: RsvpStatus })
  declare readonly status: RsvpStatus;

  @ApiProperty()
  declare readonly waitlisted: boolean;

  @ApiProperty({ enum: RsvpSource })
  declare readonly source: RsvpSource;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly respondedAt: Date;
}
