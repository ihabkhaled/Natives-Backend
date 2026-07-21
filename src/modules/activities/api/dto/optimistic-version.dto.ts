import { ApiProperty } from '@core/openapi';
import { IsInt, Min } from '@core/validation';

import { RECORD_VERSION_MIN } from '../../model/activities.constants';

/** The optimistic version a state-transition request expects to act on. */
export class ActivityOptimisticVersionDto {
  @ApiProperty({ minimum: RECORD_VERSION_MIN })
  @IsInt()
  @Min(RECORD_VERSION_MIN)
  declare readonly expectedRecordVersion: number;
}
