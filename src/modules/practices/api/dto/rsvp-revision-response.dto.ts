import { ApiProperty } from '@core/openapi';

import {
  RsvpReasonCategory,
  RsvpSource,
  RsvpStatus,
} from '../../model/rsvp.enums';

/**
 * One immutable RSVP revision. Coach-restricted (returned only via the history
 * endpoint, which requires the override permission) because it exposes the note,
 * reason category, and any override reason.
 */
export class RsvpRevisionResponseDto {
  @ApiProperty()
  declare readonly id: string;

  @ApiProperty()
  declare readonly membershipId: string;

  @ApiProperty({ enum: RsvpStatus, nullable: true })
  declare readonly fromStatus: RsvpStatus | null;

  @ApiProperty({ enum: RsvpStatus })
  declare readonly toStatus: RsvpStatus;

  @ApiProperty({ enum: RsvpReasonCategory, nullable: true })
  declare readonly reasonCategory: RsvpReasonCategory | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly note: string | null;

  @ApiProperty()
  declare readonly waitlisted: boolean;

  @ApiProperty({ enum: RsvpSource })
  declare readonly source: RsvpSource;

  @ApiProperty()
  declare readonly isOverride: boolean;

  @ApiProperty({ type: String, nullable: true })
  declare readonly overrideReason: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly actorUserId: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly occurredAt: Date;
}
