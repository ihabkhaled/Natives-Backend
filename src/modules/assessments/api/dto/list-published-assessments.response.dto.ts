import { ApiProperty } from '@core/openapi';

import { PlayerPublishedAssessmentResponseDto } from './player-published-assessment-response.dto';

/** A bounded, paginated page of the caller's own published assessments. */
export class ListPublishedAssessmentsResponseDto {
  @ApiProperty({ type: [PlayerPublishedAssessmentResponseDto] })
  declare readonly items: readonly PlayerPublishedAssessmentResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
