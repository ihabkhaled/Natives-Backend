import { ApiProperty } from '@core/openapi';

import { FeedbackSummaryResponseDto } from './feedback-summary-response.dto';

/** The ordered revision history of a coach-feedback family. */
export class FeedbackRevisionsResponseDto {
  @ApiProperty({ type: [FeedbackSummaryResponseDto] })
  declare readonly items: readonly FeedbackSummaryResponseDto[];
}
