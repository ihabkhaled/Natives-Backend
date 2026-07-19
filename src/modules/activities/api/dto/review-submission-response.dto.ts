import { ApiProperty } from '@core/openapi';

import {
  SUBMISSION_STATUS_VALUES,
  type SubmissionStatus,
} from '../../model/activity.enums';

/**
 * Reviewer-scoped submission projection (activity.review). Carries the reviewer
 * note, review actor/instant, reversal reason, and submitter identity — but never
 * an evidence storage reference, which stays behind the reviewer evidence endpoint.
 */
export class ReviewSubmissionResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly id: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly seasonId: string | null;

  @ApiProperty({ format: 'uuid' })
  declare readonly membershipId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly activityTypeId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly submitterUserId: string;

  @ApiProperty({ enum: SUBMISSION_STATUS_VALUES })
  declare readonly status: SubmissionStatus;

  @ApiProperty({ type: String, format: 'date' })
  declare readonly performedOn: string;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly durationMinutes: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly quantity: number | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly notes: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly reviewNote: string | null;

  @ApiProperty()
  declare readonly recordVersion: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly submittedAt: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly reviewedAt: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly reviewedBy: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly reviewerUserId: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly reversalReason: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly reversedAt: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: string;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: string;
}
