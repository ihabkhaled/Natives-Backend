import { ApiProperty } from '@core/openapi';
import { IsInt, IsString, MaxLength, Min, MinLength } from '@core/validation';

import {
  RECORD_VERSION_MIN,
  REVERSAL_REASON_MAX_LENGTH,
  REVERSAL_REASON_MIN_LENGTH,
} from '../../model/activities.constants';

/**
 * A correction (compensating reversal) of an approved claim. The optimistic
 * version guards a concurrent change; a non-empty structured reason is mandatory
 * so every reversal of awarded history is traceable.
 */
export class CorrectSubmissionDto {
  @ApiProperty({ minimum: RECORD_VERSION_MIN })
  @IsInt()
  @Min(RECORD_VERSION_MIN)
  declare readonly expectedRecordVersion: number;

  @ApiProperty({
    minLength: REVERSAL_REASON_MIN_LENGTH,
    maxLength: REVERSAL_REASON_MAX_LENGTH,
  })
  @IsString()
  @MinLength(REVERSAL_REASON_MIN_LENGTH)
  @MaxLength(REVERSAL_REASON_MAX_LENGTH)
  declare readonly reason: string;
}
