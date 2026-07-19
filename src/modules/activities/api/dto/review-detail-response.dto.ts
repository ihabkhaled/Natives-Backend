import { ApiProperty } from '@core/openapi';

import {
  ABUSE_SIGNAL_VALUES,
  type AbuseSignal,
} from '../../model/activity.enums';
import { BuddyResponseDto } from './buddy-response.dto';
import { ReviewSubmissionResponseDto } from './review-submission-response.dto';

/**
 * A reviewer's submission detail: the reviewer-scoped submission, its credited
 * buddies, a bounded evidence count, and the anti-abuse signals — prompts for the
 * reviewer to weigh, never an automated verdict.
 */
export class ReviewDetailResponseDto {
  @ApiProperty({ type: ReviewSubmissionResponseDto })
  declare readonly submission: ReviewSubmissionResponseDto;

  @ApiProperty({ type: [BuddyResponseDto] })
  declare readonly buddies: readonly BuddyResponseDto[];

  @ApiProperty()
  declare readonly evidenceCount: number;

  @ApiProperty({ enum: ABUSE_SIGNAL_VALUES, isArray: true })
  declare readonly signals: readonly AbuseSignal[];
}
