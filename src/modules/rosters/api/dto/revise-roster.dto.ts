import { ApiProperty } from '@core/openapi';
import { IsInt, IsString, MaxLength, Min, MinLength } from '@core/validation';

import {
  REASON_MAX_LENGTH,
  REASON_MIN_LENGTH,
  RECORD_VERSION_MIN,
} from '../../model/rosters.constants';

/**
 * Request body to supersede a published or locked roster with a new revision.
 * The reason is MANDATORY: reopening a frozen record is an audited act, and the
 * superseded roster keeps the reason forever alongside its snapshot.
 */
export class ReviseRosterDto {
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
