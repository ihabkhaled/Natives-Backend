import { ApiProperty } from '@core/openapi';

import { FeedbackSummaryResponseDto } from './feedback-summary-response.dto';

/** A bounded page of note-free coach-feedback summaries. */
export class ListCoachFeedbackResponseDto {
  @ApiProperty({ type: [FeedbackSummaryResponseDto] })
  declare readonly items: readonly FeedbackSummaryResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
