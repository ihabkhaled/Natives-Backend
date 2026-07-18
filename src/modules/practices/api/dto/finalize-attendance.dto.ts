import { ApiProperty } from '@core/openapi';
import { IsInt, Min } from '@core/validation';

import { EXPECTED_VERSION_MIN } from '../../model/practices.constants';

/**
 * Body for finalizing an attendance sheet. `expectedVersion` is required — a stale
 * value (concurrent finalize) yields a clean version conflict rather than a
 * double-lock.
 */
export class FinalizeAttendanceDto {
  @ApiProperty({ minimum: EXPECTED_VERSION_MIN })
  @IsInt()
  @Min(EXPECTED_VERSION_MIN)
  declare readonly expectedVersion: number;
}
