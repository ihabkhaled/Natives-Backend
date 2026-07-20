import { ApiProperty } from '@core/openapi';
import { IsInt, IsString, MaxLength, Min, MinLength } from '@core/validation';

import {
  REASON_MAX_LENGTH,
  REASON_MIN_LENGTH,
  RECORD_VERSION_MIN,
} from '../../model/matches.constants';

/**
 * Request body to reopen a finalized match for correction. The reason is
 * MANDATORY: unlocking a published result is an audited act, and the match keeps
 * the reason forever alongside the immutable revision row recording the score as
 * it was published.
 */
export class ReopenMatchDto {
  @ApiProperty({
    minLength: REASON_MIN_LENGTH,
    maxLength: REASON_MAX_LENGTH,
  })
  @IsString()
  @MinLength(REASON_MIN_LENGTH)
  @MaxLength(REASON_MAX_LENGTH)
  declare readonly reason: string;

  @ApiProperty({ minimum: RECORD_VERSION_MIN })
  @IsInt()
  @Min(RECORD_VERSION_MIN)
  declare readonly expectedRecordVersion: number;
}
