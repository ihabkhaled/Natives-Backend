import { ApiProperty } from '@core/openapi';

/** A member's recorded acknowledgement of shared feedback. */
export class FeedbackAcknowledgementResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly id: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly feedbackId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly membershipId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly userId: string;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly acknowledgedAt: Date;

  @ApiProperty()
  declare readonly clarificationRequested: boolean;

  @ApiProperty({ type: String, nullable: true })
  declare readonly clarificationNote: string | null;
}
