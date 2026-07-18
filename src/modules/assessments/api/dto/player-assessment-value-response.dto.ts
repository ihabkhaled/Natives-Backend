import { ApiProperty } from '@core/openapi';

/** A per-metric value as returned to team readers (includes private notes). */
export class PlayerAssessmentValueResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly metricDefinitionId: string;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly numericValue: number | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly textValue: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly note: string | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly confidence: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly observationCount: number | null;
}
