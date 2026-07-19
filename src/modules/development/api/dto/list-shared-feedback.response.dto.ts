import { ApiProperty } from '@core/openapi';

import { SharedFeedbackResponseDto } from './shared-feedback-response.dto';

/** A bounded page of the member's own shared feedback (coach note excluded). */
export class ListSharedFeedbackResponseDto {
  @ApiProperty({ type: [SharedFeedbackResponseDto] })
  declare readonly items: readonly SharedFeedbackResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
