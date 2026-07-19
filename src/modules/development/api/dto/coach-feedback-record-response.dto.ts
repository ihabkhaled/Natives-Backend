import { ApiProperty } from '@core/openapi';

import { FeedbackStatus } from '../../model/feedback.enums';

/**
 * The full coach-feedback record (team detail view under feedback.manage),
 * including the private coach note — only ever returned to feedback managers,
 * never to the assessed member.
 */
export class CoachFeedbackRecordResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly id: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly familyId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly seasonId: string | null;

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

  @ApiProperty({ type: String, nullable: true })
  declare readonly positiveFrisbee: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly frisbeeImprovement: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly positiveMental: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly mentalImprovement: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly teamRole: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly recommendedPosition: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly summary: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly coachNote: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly submittedAt: Date | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly submittedBy: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly publishedAt: Date | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly publishedBy: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly supersededAt: Date | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly supersededById: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly createdBy: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;
}
