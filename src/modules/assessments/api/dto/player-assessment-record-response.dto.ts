import { ApiProperty } from '@core/openapi';

import { PlayerAssessmentStatus } from '../../model/player-assessments.enums';

/** The per-player assessment aggregate row (a single revision in a family). */
export class PlayerAssessmentRecordResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly id: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly familyId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly seasonId: string | null;

  @ApiProperty({ format: 'uuid' })
  declare readonly periodId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly templateId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly membershipId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly evaluatorUserId: string;

  @ApiProperty({ enum: PlayerAssessmentStatus })
  declare readonly status: PlayerAssessmentStatus;

  @ApiProperty()
  declare readonly revision: number;

  @ApiProperty({ type: String, nullable: true })
  declare readonly summary: string | null;

  @ApiProperty()
  declare readonly recordVersion: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly submittedAt: Date | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly submittedBy: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly reviewedAt: Date | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly reviewedBy: string | null;

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
