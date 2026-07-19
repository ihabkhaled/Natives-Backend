import { ApiProperty } from '@core/openapi';

import { BuddyResponseDto } from './buddy-response.dto';
import { SubmissionResponseDto } from './submission-response.dto';

/** A submission with its credited buddies and a bounded evidence count. */
export class SubmissionDetailResponseDto {
  @ApiProperty({ type: SubmissionResponseDto })
  declare readonly submission: SubmissionResponseDto;

  @ApiProperty({ type: [BuddyResponseDto] })
  declare readonly buddies: readonly BuddyResponseDto[];

  @ApiProperty()
  declare readonly evidenceCount: number;
}
