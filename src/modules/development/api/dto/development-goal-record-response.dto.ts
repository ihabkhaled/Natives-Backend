import { ApiProperty } from '@core/openapi';

import { GoalStatus } from '../../model/goal.enums';

/** The development-goal aggregate row. */
export class DevelopmentGoalRecordResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly id: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly seasonId: string | null;

  @ApiProperty({ format: 'uuid' })
  declare readonly membershipId: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly feedbackId: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly metricDefinitionId: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly ownerUserId: string | null;

  @ApiProperty()
  declare readonly title: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly description: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly measurableTarget: string | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly targetValue: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly baselineValue: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly progressValue: number | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly progressNote: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly evidence: string | null;

  @ApiProperty({ enum: GoalStatus })
  declare readonly status: GoalStatus;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  declare readonly dueDate: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly completedAt: Date | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly reviewNote: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly reviewedAt: Date | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly reviewedBy: string | null;

  @ApiProperty()
  declare readonly recordVersion: number;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly createdBy: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;
}
