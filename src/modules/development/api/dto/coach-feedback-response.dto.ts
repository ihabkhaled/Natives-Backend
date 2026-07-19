import { ApiProperty } from '@core/openapi';

import { CoachFeedbackRecordResponseDto } from './coach-feedback-record-response.dto';
import { FeedbackAcknowledgementResponseDto } from './feedback-acknowledgement-response.dto';

/** A coach feedback with its optional member acknowledgement (team detail view). */
export class CoachFeedbackResponseDto {
  @ApiProperty({ type: CoachFeedbackRecordResponseDto })
  declare readonly feedback: CoachFeedbackRecordResponseDto;

  @ApiProperty({ type: FeedbackAcknowledgementResponseDto, nullable: true })
  declare readonly acknowledgement: FeedbackAcknowledgementResponseDto | null;
}
