import { ApiProperty } from '@core/openapi';

import { FeedbackStatus } from '../../model/feedback.enums';

/**
 * A note-free coach-feedback summary for the bounded team list. It deliberately
 * carries no free-text field — above all no coach note — so a broad list can
 * never surface private content.
 */
export class FeedbackSummaryResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly id: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly familyId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly membershipId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly authorUserId: string;

  @ApiProperty({ enum: FeedbackStatus })
  declare readonly status: FeedbackStatus;

  @ApiProperty()
  declare readonly revision: number;

  @ApiProperty()
  declare readonly recordVersion: number;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly publishedAt: Date | null;
}
