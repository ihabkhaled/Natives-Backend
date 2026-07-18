import { ApiProperty } from '@core/openapi';

import { PlayerAssessmentSummaryResponseDto } from './player-assessment-summary-response.dto';

/** A bounded, paginated page of team player assessments. */
export class ListPlayerAssessmentsResponseDto {
  @ApiProperty({ type: [PlayerAssessmentSummaryResponseDto] })
  declare readonly items: readonly PlayerAssessmentSummaryResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
