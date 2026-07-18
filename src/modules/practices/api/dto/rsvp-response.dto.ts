import { ApiProperty } from '@core/openapi';

import {
  RsvpNoteVisibility,
  RsvpReasonCategory,
  RsvpSource,
  RsvpStatus,
} from '../../model/rsvp.enums';

/**
 * A member's own RSVP. When the member has not answered yet, `status` is
 * `no_response` and the metadata fields are null (absence modelled explicitly).
 */
export class RsvpResponseDto {
  @ApiProperty()
  declare readonly sessionId: string;

  @ApiProperty()
  declare readonly membershipId: string;

  @ApiProperty({ enum: RsvpStatus })
  declare readonly status: RsvpStatus;

  @ApiProperty({ enum: RsvpReasonCategory, nullable: true })
  declare readonly reasonCategory: RsvpReasonCategory | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly note: string | null;

  @ApiProperty({ enum: RsvpNoteVisibility, nullable: true })
  declare readonly noteVisibility: RsvpNoteVisibility | null;

  @ApiProperty({ enum: RsvpSource, nullable: true })
  declare readonly source: RsvpSource | null;

  @ApiProperty()
  declare readonly waitlisted: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly respondedAt: Date | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly version: number | null;
}
