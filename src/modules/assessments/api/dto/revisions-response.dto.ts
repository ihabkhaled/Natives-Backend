import { ApiProperty } from '@core/openapi';

import { PlayerAssessmentSummaryResponseDto } from './player-assessment-summary-response.dto';

/** The full revision history of an assessment family, oldest first. */
export class RevisionsResponseDto {
  @ApiProperty({ type: [PlayerAssessmentSummaryResponseDto] })
  declare readonly items: readonly PlayerAssessmentSummaryResponseDto[];
}
