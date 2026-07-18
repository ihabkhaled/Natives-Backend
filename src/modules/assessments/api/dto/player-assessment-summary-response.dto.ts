import { ApiProperty } from '@core/openapi';

import { PlayerAssessmentStatus } from '../../model/player-assessments.enums';

/** A light row for the bounded team list of player assessments and revisions. */
export class PlayerAssessmentSummaryResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly id: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly familyId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly periodId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly membershipId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly evaluatorUserId: string;

  @ApiProperty({ enum: PlayerAssessmentStatus })
  declare readonly status: PlayerAssessmentStatus;

  @ApiProperty()
  declare readonly revision: number;

  @ApiProperty()
  declare readonly recordVersion: number;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly publishedAt: Date | null;
}
