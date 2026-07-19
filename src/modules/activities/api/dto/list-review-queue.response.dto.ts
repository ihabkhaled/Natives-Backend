import { ApiProperty } from '@core/openapi';

import { ReviewSubmissionResponseDto } from './review-submission-response.dto';

/** A bounded, deterministically ordered page of the reviewer queue. */
export class ListReviewQueueResponseDto {
  @ApiProperty({ type: [ReviewSubmissionResponseDto] })
  declare readonly items: readonly ReviewSubmissionResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
