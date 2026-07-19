import { ApiProperty } from '@core/openapi';

import {
  SUBMISSION_STATUS_VALUES,
  type SubmissionStatus,
} from '../../model/activity.enums';

/**
 * Member-safe submission projection. Deliberately excludes the reviewer note and
 * never carries an evidence storage reference.
 */
export class SubmissionResponseDto {
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

  @ApiProperty()
  declare readonly recordVersion: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly submittedAt: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly withdrawnAt: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: string;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: string;
}
