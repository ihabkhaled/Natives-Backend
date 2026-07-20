import { ApiProperty } from '@core/openapi';
import { IsInt, Min } from '@core/validation';

import { RECORD_VERSION_MIN } from '../../model/rosters.constants';

/**
 * Request body to freeze a published roster (roster.lock). The optimistic record
 * version proves the caller froze the selection they actually reviewed.
 */
export class LockRosterDto {
  @ApiProperty({ minimum: RECORD_VERSION_MIN })
  @IsInt()
  @Min(RECORD_VERSION_MIN)
  declare readonly expectedRecordVersion: number;
}
