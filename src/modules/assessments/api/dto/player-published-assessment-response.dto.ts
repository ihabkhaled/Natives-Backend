import { ApiProperty } from '@core/openapi';

import { PlayerAssessmentStatus } from '../../model/player-assessments.enums';

/** A per-metric value shaped for the assessed player: private notes removed. */
export class PlayerPublishedValueResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly metricDefinitionId: string;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly numericValue: number | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly textValue: string | null;
}

/** A published assessment as the assessed player sees it (member-visible only). */
export class PlayerPublishedAssessmentResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly id: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly periodId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly templateId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly membershipId: string;

  @ApiProperty({ enum: PlayerAssessmentStatus })
  declare readonly status: PlayerAssessmentStatus;

  @ApiProperty()
  declare readonly revision: number;

  @ApiProperty({ type: String, nullable: true })
  declare readonly summary: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly publishedAt: Date | null;

  @ApiProperty({ type: [PlayerPublishedValueResponseDto] })
  declare readonly values: readonly PlayerPublishedValueResponseDto[];
}
